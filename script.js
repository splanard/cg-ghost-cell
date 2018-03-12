var INFO = 0, DEBUG = 1, TRACE = 2;
var _logLevel = DEBUG;

var _factoryCount = parseInt(readline()); // the number of factories
var _linkCount = parseInt(readline()); // the number of links between factories

var _turn = 0; // current game turn

var _actions; // actions of the current turn

var _bombCount = 2; // remaining bombs
var _bombWait = 0; // nb of turns before sending another bomb

var _prodDelta = 0;

var THREAT_LEVEL_ALARM = 1; // ratio threat/cyborgs above which factory raise the alarm
var RESERVE_RATIO = 0; // ratio, relative to production level, below which factory stands

var SCORE_PRODUCTION_WEIGHT = 10; // weight of 1 production in the score calculation
var SCORE_CYBORGS_WEIGHT = 0; // weight of cyborgs in the score calculation
var SCORE_DISTANCE_WEIGHT = 0.7; // weight of the distance between 2 factories in the score calculation

var _factories = {}; // all factories, by their id
var _bombs = {}; // all enemy bombs, by their id

// factory builder
function factory( id ){
	return {
		'id': id,
		'owner': 0, // owner of the factory.re-eval on update.
		'production': 0, // production of the factory. re-eval on update.
		'cyborgs': 0, // cyborgs in the factory. re-eval on update, decreased after every move.
		'score': {}, // statistical score of the factory. <0 if closest to the enemy, >0 if closest to me.
		'links': [], // list of linked factories, from the closest to the farest. do not change after init.
		'incomings': {}, // every incoming troops targeting this factory. reset then increased on update.
		'evacuation': {},
		'bomb': function( targetId, distance ){
			if( this.owner === 1 ){
				_actions.push( 'BOMB ' + this.id + ' ' + targetId );
				_bombCount--;
				_bombWait = distance + 2;
				info( 'Bombs left: ' + _bombCount );
			}
		},
		'cleanUp': function(){
			delete this.incomings[_turn - 1];
			delete this.score[_turn - 1];
		},
		'getIncomings': function(){
			this.initIncomings();
			return this.incomings[_turn];
		},
		'getScore': function(){
			this.initScore();
			return this.score[_turn];
		},
		'inc': function(){
		    if( this.owner === 1 ){
		        _actions.push( 'INC ' + this.id );
		        this.cyborgs -= 10;
		    }
		},
		'incIncomings': function( val ){
		    this.initIncomings();
		    this.incomings[_turn] += val;
		},
		'incScore': function( val ){
		    this.initScore();
		    this.score[_turn] += val;
		},
		'initIncomings': function(){
			if( this.incomings[_turn] === undefined ){
				this.incomings[_turn] = 0;
			}
		},
		'initScore': function(){
		    if( this.score[_turn] === undefined ){
				this.score[_turn] = 0;
			}
		},
		'reserve': function(){
		    return RESERVE_RATIO * this.production;
		},
		'send': function( targetId, cbToSend ){
			if( this.owner === 1 ){
				_actions.push( 'MOVE ' + this.id + ' ' + targetId + ' ' + cbToSend );
				this.cyborgs -= cbToSend;
				//this.incScore( -cbToSend );
			}
		},
		'update': function( owner, cyborgs, production ){
			// raw data
			this.owner = owner;
			this.cyborgs = cyborgs;
			this.production = production;
			
			this.cleanUp(); // clean up last turn data
			
			this.incScore( owner * cyborgs );
		}
	}
}

// link builder
function link( id, distance ){
	return {
		'id': id,
		'distance': distance
	}
}

// data structure initialisation
function init(){ 
	// init factories
	for( var i=0; i < _factoryCount; i++ ){
		_factories[i] = factory( i );
	}
 
    for( var j=0; j < _linkCount; j++ ){
        // Given the time allowed for round 1, there must be many things to do...
        var inputs = readline().split(' ');
        var factory1 = parseInt(inputs[0]);
        var factory2 = parseInt(inputs[1]);
        var distance = parseInt(inputs[2]);
		
		initLink( factory1, factory2, distance );
    }
    
    trace( 'factories: ' + JSON.stringify( _factories, null, 2 ) );
}

// build the links data structure
function initLink( id1, id2, distance ){
	_factories[id1].links.push( link( id2, distance ) );
	_factories[id2].links.push( link( id1, distance ) );
}

// updates data concerning a factory
function updateFactory( id, owner, cyborgs, production ){
    trace('update Factory [' + id + ']: owner ' + owner + ', cyborgs ' + cyborgs + ', prod ' + production);
	var f = _factories[ id ];
	
	f.update( owner, cyborgs, production );	// update factory properties
	
	// update production delta
	_prodDelta += owner * production;
	
	// push data to linked factories
	for( var i=0, maxi=f.links.length; i < maxi; i++ ){
		var l = f.links[i];
		var lf = _factories[ l.id ];
		lf.incScore( owner * (cyborgs + production) / Math.pow( l.distance, SCORE_DISTANCE_WEIGHT ) );
	}
}

// updates data concerning a troop
function updateTroop( id, owner, src, dest, cyborgs, distance ){
	trace( 'update Troop [' + id + ']: owner ' + owner + ', src ' + src + ', dest ' + dest + ', cyborgs ' + cyborgs + ', distance ' + distance );
	
	// push data to source factory
	// var src = _factories[ src ];
	// TODO?
	
	// push data to destination factory
	var df = _factories[ dest ];
    df.incScore( owner * cyborgs / distance );
    df.incIncomings( owner * cyborgs );
}

// updates data concerning a bomb
function updateBomb( id, owner, src, dest, turnBeforeExplosion ){
	trace( 'update Bomb [' + id + ']: owner ' + owner + ', src ' + src + ', dest ' + dest + ', turns ' + turnBeforeExplosion );
	if( owner === -1 ){
	    // no access to dest, turnBeforeExplosion !
	    if( _bombs[id] === undefined ){ // new bomb
	        _bombs[id] = {}
	    }
	    _bombs[id].lastUpdate = _turn;
	    
	    var sf = _factories[src];
	    for( var i=0, maxi=sf.links.length; i < maxi; i++ ){
	        var l = sf.links[i];
	        var lf = _factories[ l.id ];
	        if( lf.owner === 1 ){
	            // register evacuate order
	            var evacTurn = _turn + l.distance - 1;
	            lf.evacuation[ evacTurn ] = {
	                bombId: id
	            }
	        }
	    }
	}
}

// calculate actions for a factory
function action( f ){
	debug( 'action Factory [' + f.id + '] cyborgs: ' + f.cyborgs +', score: ' + f.getScore().toFixed(1) );
    
    // order targets
    var targets = f.links.slice();
    if( _prodDelta < 2 && f.production < 3 ){
        targets.push( { 'id': 'I', 'distance': 4 } );    
    }
    targets.sort( function(a, b){
        var result = compareIntAsc( a.distance, b.distance );
        var incFactory = { 'production': 1, 'getScore': function(){ return 0; } };
        var fa = a.id === 'I' ? incFactory : _factories[a.id];
        var fb = b.id === 'I' ? incFactory : _factories[b.id];
        if( result === 0 ){
            result = compareIntDesc( fa.production, fb.production );
        }
        if( result === 0 ){
            result = compareIntDesc( fa.getScore(), fb.getScore() );
        }
        return result;
    });
    
	// for every linked factory, decide action
	var i = 0, max = targets.length;
	while( i < max && f.cyborgs > f.reserve() ){
		// increase prod
        if( targets[i].id === 'I' ){
            debug('  increase prod? prodDelta: ' + _prodDelta );
            if( f.getScore() >= 10 ){
                f.inc();
            }
            i++; continue;
        }
		
		// init
		var tf = _factories[targets[i].id];
		var distance = targets[i].distance;
		var nbSent = 0;
		var bomb = false;
        
        debug('  target [' + tf.id 
                + '] owner: ' + tf.owner 
                + ', score: ' + tf.getScore().toFixed(1) 
                + ', distance: ' + distance
                + ', incomings: ' + tf.getIncomings() );
        
        switch( tf.owner ){
            // ALLY
            case 1:
                // Incoming bomb -> evacuation
                var evac = f.evacuation[_turn];
                if( evac !== undefined 
                        && _bombs[evac.bombId]
                        && _bombs[evac.bombId].lastUpdate === _turn ){
                    nbSent = f.cyborgs;
                    debug('  -> EVACUATION ' + nbSent );
                }
                // No prod -> evacuation
                else if( f.production === 0 && tf.getScore() > 0 && tf.production > 0 ){
                    nbSent = f.cyborgs;
                    debug('  -> EVACUATION (no prod) ' + nbSent );
                }
                // Support weaker ally
                else if( f.getScore() > tf.getScore() && tf.production > 0 ){
                    nbSent = Math.trunc( (f.getScore() - tf.getScore())/2 );
                    debug('  -> SUPPORT ' + nbSent );
                }
                
                break;
            
            // NEUTRAL
            case 0:
                // Neutral prod > 0 in my "control zone" -> capture
                if( tf.production > 0 
                        && tf.getScore() > 0 
                        && tf.cyborgs - tf.getIncomings() > 0
                        && f.cyborgs >= tf.cyborgs - tf.getIncomings() + 1 ){
                    nbSent = f.production > 0 ? tf.cyborgs - tf.getIncomings() + 1 : f.cyborgs;
                    debug('  -> CAPTURE ' + nbSent );
                }
                break;
            
            // ENEMY
            case -1:
                // strong enemy factory 
                // TODO: improve this
                if( _bombCount > 0 && _bombWait === 0 && tf.production === 3 ){
                    bomb = true;
                    debug('  -> BOMB');
                }
                // close enemy factory in my control zone -> capture if possible
                else if( tf.getScore() > 0 
                        && tf.production > 0
                        && distance <= 3 
                        && f.cyborgs > tf.cyborgs + tf.production - tf.getIncomings() ){
                    nbSent = tf.cyborgs + tf.production - tf.getIncomings() + 1;
                    debug('  -> CAPTURE ' +  nbSent );
                }
                // enemy factory in my "control zone" -> attack
                else if( tf.getScore() > 0 
                        && f.getScore() > tf.getScore()
                        && f.cyborgs >= tf.production + 1 ){
                    nbSent = tf.production + 1;
                    debug('  -> ATTACK ' +  nbSent );
                }
                break;
        }

		if( bomb ){
			f.bomb( tf.id, distance );
		}
		else if( nbSent > 0 ){
			f.send( tf.id, nbSent );
		}

		i++;
	}
}


init();
// game loop
while (true) {
	// pre-update actions
	_actions = ['WAIT']; // reset turn actions
	_turn++; // update turn number
	debug( 'TURN ' + _turn );
	_prodDelta = 0;
	
	// decrease bomb wait
	if( _bombWait > 0 ){
		_bombWait--;
	}
	
	// the number of entities (e.g. factories and troops)	
    var entityCount = parseInt(readline());
	
    // update entities data
    for( var i=0; i < entityCount; i++ ){
        var inputs = readline().split(' ');
        var entityId = parseInt(inputs[0]);
        var entityType = inputs[1];
        var arg1 = parseInt(inputs[2]);
        var arg2 = parseInt(inputs[3]);
        var arg3 = parseInt(inputs[4]);
        var arg4 = parseInt(inputs[5]);
        var arg5 = parseInt(inputs[6]);
		
		if( entityType === 'FACTORY' ){
			updateFactory( entityId, arg1, arg2, arg3 );
		}
		else if( entityType === 'TROOP' ){
			updateTroop( entityId, arg1, arg2, arg3, arg4, arg5 );
		}
		else if( entityType === 'BOMB' ){
			updateBomb( entityId, arg1, arg2, arg3, arg4 );
		}
    }
    
    test();
	
	// resolve actions
	var f;
	for( var j=0; j < _factoryCount; j++ ){
		f = _factories[j];
		if( f.owner === 1 ){ action( f ); }
	}
	
	// print actions
	print( _actions.join(';') );
}


function test(){
    var fs = [];
    for( var i=0; i < _factoryCount; i++ ){
        fs.push( _factories[i] );
    }
    
    fs.sort( function( a, b ){
        var result = compareIntDesc( a.getScore(), b.getScore() );
        if( result === 0 ){
            result = compareIntDesc( a.production, b.production );
        }
        return result;
    })
    
    for( var j=0; j < _factoryCount; j++ ){
        var f = fs[j];
        var state = 'MOVE';
        
        switch( f.owner ){
            // ALLY
            case 1:
                var evac = f.evacuation[_turn];
                if( evac !== undefined 
                        && _bombs[evac.bombId]
                        && _bombs[evac.bombId].lastUpdate === _turn ){
                    state = 'EVACUATE';
                }
                else if( f.production === 0 ){
                    state = 'EVACUATE (no prod)';
                }
                else if( f.getScore() < f.production ){
                    state = 'SUPPORT';
                }
                break;
            
            // NEUTRAL
            case 0:
                if( f.getScore() > 0 && f.production > 0 && f.cyborgs - f.getIncomings() > 0 ){
                    state = 'CAPTURE';
                }
                break;
            
            // ENEMY
            case -1:
                if( f.getScore() > 0 ){
                    state = 'ATTACK';
                }
                break;
        }
        
        debug( '[' + f.id + ']: score ' + f.getScore().toFixed(2) 
                + ', owner ' + f.owner 
                + ', cyborgs ' + f.cyborgs 
                + ', incomings ' + f.getIncomings() );
        debug( '  => ' + state );
    }
}


function compareIntAsc( a, b ){ return a - b; }
function compareIntDesc( a, b ){ return b - a; }

function trace( msg ){
	if( _logLevel >= TRACE ){ printErr( msg ); }
}
function debug( msg ){
	if( _logLevel >= DEBUG ){ printErr( msg ); }
}
function info( msg ){
	if( _logLevel >= INFO ){ printErr( msg ); }
}

function logJson( json ){
	return JSON.stringify( json, null, 2 );
}