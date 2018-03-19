// Factories
var _factoryCount = parseInt(readline()); // the number of factories
var _factories = {};
var _myFactories, _enemyFactories, _neutralFactories, _maxEta;

// Links and distances
var _distances = {
	'get': function( id1, id2 ){
		if( id1 < id2 ){ return this[id1][id2]; }
		if( id1 > id2 ){ return this[id2][id1]; }
		return 0;
	}
};
var _maxDistance = 0;
for( var i=0; i < _factoryCount; i++ ){
	_distances[i] = {};
}
var linkCount = parseInt(readline()); // the number of links between factories
for (var i = 0; i < linkCount; i++) {
    var inputs = readline().split(' ');
    var f1 = parseInt(inputs[0]);
    var f2 = parseInt(inputs[1]);
	var distance = parseInt(inputs[2]);
	_distances[f1][f2] = distance;
	
	if( distance > _maxDistance ){ _maxDistance = distance; }
}

// Bombs
var _bombCount = 2;
var _enemyBombs, _enemyBombedFactories;
var _enemyBombLive = {
	// bombId: liveTurns
};

// game loop
while (true) {
	// Init
	_myFactories = [];
	_enemyFactories = [];
	_neutralFactories = [];
	_enemyBombs = [];
	_enemyBombedFactories = [];
	_maxEta = 0;
	
	// INPUTS
    var entityCount = parseInt(readline()); // the number of entities (e.g. factories and troops)
    for( var i = 0; i < entityCount; i++ ){
        var inputs = readline().split(' ');
        var entityId = parseInt(inputs[0]);
        var entityType = inputs[1];
        var arg1 = parseInt(inputs[2]);
        var arg2 = parseInt(inputs[3]);
        var arg3 = parseInt(inputs[4]);
        var arg4 = parseInt(inputs[5]);
        var arg5 = parseInt(inputs[6]);
		
		// Factory inputs
		if( entityType === 'FACTORY' ){
			var f = {
				'id': entityId,
				'cyborgs': arg2, // number of cyborgs currently in the factory
				'owner': arg1, // 1:mine, -1:opponent, 0:neutral
				'production': arg3,
				'tbnp': arg4 // Turns Before Normal Production. 0 if production is normal.
			};
			
			// IDs lists
			if( f.owner === 1 ){
				_myFactories.push( f.id );
			}
			else if( f.owner === -1 ){
				_enemyFactories.push( f.id );
			}
			else {
				_neutralFactories.push( f.id );
			}
			
			// Init incomings
			f.incomings = {
				'allies': {
					'max': 0
				},
				'enemies': {
					'max': 0
				},
				'add': function( turns, number, ally ){
					// Update incomings data for this factory
					var sub = ally ? 'allies' : 'enemies';
					if( !this[sub][turns] ){
						this[sub][turns] = 0;
					}
					this[sub][turns] += number;
					// Update number of turns during which I have incomings data for this factory
					if( turns > this[sub]['max'] ){
						this[sub]['max'] = turns;
					}
					// Update number of turns during which I have global incomings data
					if( turns > _maxEta ){
						_maxEta = turns;
					}
				}
			};
			
			_factories[entityId] = f;
		}
			
		// Troop inputs
		else if( entityType === 'TROOP' ){
			var destFactory = _factories[arg3];
			destFactory.incomings.add( arg5, arg4, arg1 === 1 );
		}
			
		// Bomb inputs
		else { // entityType = 'BOMB'
			// Enemy bomb
			if( arg1 === -1 ){
				if( _enemyBombLive[entityId] !== undefined ){
					_enemyBombLive[entityId]++;
				}
				else {
					_enemyBombLive[entityId] = 1;
				}
				_enemyBombs.push({
					'id': entityId,
					'source': arg2,
					'liveTime': _enemyBombLive[entityId]
				});
			}
			// My bomb
			else {
				_enemyBombedFactories.push( arg3 );
			}
		}
    }
	
	// ---------- limit inputs storage / outputs compilation ----------
	
	// Factories average distance from mines
	for( var i=0; i < _factoryCount; i++ ){
		var f = _factories[i];
		var avg = 0;
		for( var j=0; j < _myFactories.length; j++ ){
			avg += _distances.get( f.id, _myFactories[j] );
		}
		f.avgDist = avg;
	}
	
	// OUTPUTS
	
	/* 
	 * Possible actions :
	 *	. Support a threatened ally factory
	 *	. Attack a neutral factory to capture it
	 *	. Attack an enemy factory to capture it
	 *	Send cyborgs to an ally factory so that it can capture close enemies/neutral
	 *	. Evacuate a factory when a bomb will hit it
	 *	Reinforce a bombed factory, the turn after it has been hit
	 *	. Increase production
	 *	. Bomb enemy factory
	 */
	// TODO: implement missing actions
	
	var possibleActions = [];
		
	// Next turns simulation to determine possible actions
	var simulation = {};
	var count = 1;
	var simFactories = clone( _factories );
	while( count <= _maxDistance ){
		for( var i=0; i < _factoryCount; i++ ){
			var f = simFactories[i];
			
			// Move incoming troops
			updateIncomings( f.incomings.allies );
			updateIncomings( f.incomings.enemies );
			
			// Move bombs
			// TODO!
			
			// Produce new cyborgs
			if( f.owner !== 0 ){
				f.cyborgs += f.production;
			}
			
			// Solve battles
			var incAllies = f.incomings.allies[0] ? f.incomings.allies[0] : 0;
			var incEnemies = f.incomings.enemies[0] ? f.incomings.enemies[0] : 0;
			
			// Ally factory
			if( f.owner === 1 ){
				var result = f.cyborgs - ( incEnemies - incAllies );
				if( result < 0 ){
					// Threatened ally factory
					f.owner = -1;
					f.cyborgs = Math.abs( result );
					//printErr('Ally factory [' + f.id + '] falls in ' + (count - 1) + ' turn(s)');
					
					possibleActions.push({
						'name': 'support ally',
						'actionFactory': undefined,
						'targetFactory': f.id,
						'cyborgs': f.cyborgs,
						'turnsEffect': count - 1,
						'score': actionScore( f.production, f.cyborgs, f.avgDist )
					});
				} else {
					f.cyborgs = result;
				}
			}
			// Enemy factory
			else if( f.owner === -1 ){
				var result = f.cyborgs - ( incAllies - incEnemies );
				if( result < 0 ){
					f.owner = 1;
					f.cyborgs = Math.abs( result );
					//printErr('Enemy factory [' + f.id + '] captured in ' + (count - 1) + ' turn(s)');
				} else {
					f.cyborgs = result;
					possibleActions.push({
						'name': 'attack enemy',
						'actionFactory': undefined,
						'targetFactory': f.id,
						'cyborgs': f.cyborgs + f.production + 1,
						'turnsEffect': count - 1,
						'score': actionScore( f.production, f.cyborgs + f.production + 1, f.avgDist )
					});
				}
			}
			// Neutral factory
			else {
				var result = f.cyborgs - Math.abs( incAllies - incEnemies );
				if( result < 0 && incAllies > incEnemies ){
					f.owner = 1;
					f.cyborgs = Math.abs( result );
					//printErr('Neutral factory [' + f.id + '] captured in ' + (count - 1) + ' turn(s)');
				}
				else if( result < 0 ){
					f.owner = -1;
					f.cyborgs = Math.abs( result );
					//printErr('Neutral factory [' + f.id + '] falls in ' + (count - 1) + ' turn(s)');
					possibleActions.push({
						'name': 'attack enemy',
						'actionFactory': undefined,
						'targetFactory': f.id,
						'cyborgs': f.cyborgs + 1,
						'turnsEffect': count - 1,
						'score': actionScore( f.production, f.cyborgs + 1, f.avgDist )
					});
				}
				else {
					f.cyborgs = result;
					possibleActions.push({
						'name': 'capture neutral',
						'actionFactory': undefined,
						'targetFactory': f.id,
						'cyborgs': f.cyborgs + 1,
						'turnsEffect': count - 1,
						'score': actionScore( f.production, f.cyborgs + 1, f.avgDist )
					});
				}
			}
			
			// Bombs explosions
			// TODO!
		}
		simulation[count] = clone( simFactories );
		count++;
	}
	
	// Evacuation/reinforcement & Increase production actions
	for( var i=0; i < _myFactories.length; i++ ){
		var f = _factories[_myFactories[i]];
		
		// Bombs actions
		for( var j=0; j < _enemyBombs.length; j++ ){
			var b = _enemyBombs[j];
			var d = _distances.get( b.source, f.id );
			// Evacuation
			if( b.liveTime === d ){
				//printErr('Ally factory [' + f.id + '] possibly bombed !');
				possibleActions.push({
					'name': 'evacuate',
					'actionFactory': f.id,
					'targetFactory': undefined,
					'cyborgs': f.cyborgs,
					'score': actionScore( f.production, 0, 0 )
				});
			}
			
			// Reinforce bombed factory
			// TODO!
		}
		
		// Bomb enemy factory actions
		if( _bombCount > 0 ){
			for( var j=0; j < _enemyFactories.length; j++ ){
				var ef = _factories[_enemyFactories[j]];
				if( _enemyBombedFactories.indexOf( ef.id ) < 0 && ef.production > 0 ){
					possibleActions.push({
						'name': 'bomb enemy',
						'actionFactory': undefined,
						'targetFactory': ef.id,
						'cyborgs': 0,
						'score': actionScore( ef.production, 0, ef.avgDist )
					});
				}
			}
		}
		
		// Increase production actions
		if( f.cyborgs >= 10 && f.production < 3 ){
			possibleActions.push({
				'name': 'increase production',
				'actionFactory': f.id,
				'cyborgs': 10,
				'score': actionScore( 1, 10, 0 )
			});
		}
		
		// Share cyborgs actions
		for( var j=0; j < _myFactories.length; j++ ){
			var af = _factories[_myFactories[j]];
			if( f.cyborgs > af.cyborgs + 1 ){
				possibleActions.push({
					'name': 'split cyborgs',
					'actionFactory': f.id,
					'targetFactory': af.id,
					'cyborgs': Math.floor( (f.cyborgs - af.cyborgs) / 2 ),
					'score': actionScore( 0.01, 0, 0 )
				});
			}
		}
	}
	
	// Sort possible actions: by desc score, then by asc turns
	possibleActions.sort( function(a, b){
		if( a.score !== b.score ){
			return b.score - a.score;
		}
		return a.turns - b.turns;
	});
	
	//printErr( stringify( possibleActions ) );
	
	// Resolve actions
	var actions = [];
	var actionableFactories = {
		'list': _myFactories.slice(),
		'remove': function( id ){
			var index = this.list.indexOf( id );
			if( index >= 0 ){
				this.list.splice( index, 1 );
			}
		}
	}
	var handledTargets = [];
	while( actionableFactories.list.length > 0 && possibleActions.length > 0 ){
		var a = possibleActions.shift();
		switch( a.name ){
			case 'attack enemy':
			case 'capture neutral':
			case 'support ally':
				if( handledTargets.indexOf( a.targetFactory ) < 0 ){
					// Potential actions factories
					var pActionFactories = actionableFactories.list.slice();
					var iotf = pActionFactories.indexOf( a.targetFactory );
					if( iotf >= 0 ){
						// Target factory cannot be action factory
						pActionFactories.splice( iotf, 1 );
					}
					// Action factories
					var actionsFactories = findActionFactories( pActionFactories, a.targetFactory, a.turnsEffect, a.cyborgs );
					if( actionsFactories.length > 0 ){
						for( var i=0; i < actionsFactories.length; i++ ){
							var af = actionsFactories[i];
							// Move command
							actions.push( move( af.id, a.targetFactory, af.cyborgs ) );
							// Remove action factory from actionables
							if( af.cyborgs === 0 ){
								actionableFactories.remove( af.id );
							}
						}
						// Mark target factory handled
						handledTargets.push( a.targetFactory );
					}
				}
				break;

			case 'bomb enemy':
				// Find closest factory
				var actionFactory = findClosestMinCyborgs( actionableFactories.list, a.targetFactory, 0 );
				if( actionFactory >= 0 ){
					// Bomb command
					actions.push( bomb( actionFactory, a.targetFactory ) );
					// Remove actionFactory from actionables
					actionableFactories.remove( actionFactory );
				}
				break;

			case 'evacuate':
				// Find closest ally to transfer the cyborgs
				var myOtherFactories = _myFactories.slice();
				myOtherFactories.splice( myOtherFactories.indexOf( a.actionFactory ), 1 );
				var targetFactory = findClosest( myOtherFactories, a.actionFactory );
				if( targetFactory >= 0 ){
					// Move command
					actions.push( move( a.actionFactory, targetFactory, a.cyborgs ) );
					// Remove actionFactory from actionables
					actionableFactories.remove( a.actionFactory );
				}
				break;

			case 'increase production':
				// Move command
				actions.push( increaseProduction( a.actionFactory ) );
				// Remove actionFactory from actionables
				if( _factories[a.actionFactory].cyborgs === 0 ){
					actionableFactories.remove( a.actionFactory );
				}
				break;

			case 'reinforced bombed ally':
				// TODO!
				break;

			case 'split cyborgs':
				// Move command
				actions.push( move( a.actionFactory, a.targetFactory, a.cyborgs ) );
				// Remove actionFactory from actionables
				if( _factories[a.actionFactory].cyborgs === 0 ){
					actionableFactories.remove( a.actionFactory );
				}
				break;
		}
	}

	// Print actions
	if( actions.length === 0 ){
		actions.push('WAIT');
	}
    print( actions.join(';') );
}

function actionScore( productionGain, cyborgsEngaged, distance ){
	var cybDen = cyborgsEngaged > 0 ? cyborgsEngaged : 1;
	var distDen = distance > 0 ? Math.pow( distance, 2 ) : 1;
	return productionGain / cybDen / distDen;
}

function findActionFactories( ids, from, maxDistance, cyborgsNeeded ){
	// Order list by asc distance first, then by desc number of cyborgs
	var orderedIds = ids.sort( function(a, b){
		var da = _distances.get(a, from);
		var db = _distances.get(b, from);
		if( da !== db ){
			return da - db;
		}
		else {
			return _factories[b].cyborgs - _factories[a].cyborgs;
		}
	});
	
	// Search for matching factories
	var found = [];
	for( var i=0; i < orderedIds.length; i++ ){
		var d = _distances.get( orderedIds[i], from );
		if( d > maxDistance ){ break; }
		var cybs = Math.min( cyborgsNeeded, _factories[orderedIds[i]].cyborgs );
		if( cybs > 0 ){
			found.push( { 'id': orderedIds[i], 'cyborgs': cybs } );
			cyborgsNeeded -= cybs;
		}
		if( cyborgsNeeded <= 0 ){ break; }
	}
	
	return found;
}

function findMaxDistanceMinCyborgs( list, from, maxDistance, minCyborgs ){
	var orderedList = list.sort( function(a, b){ return _distances.get(b, from) - _distances.get(a, from); } );
	for( var i=0; i < orderedList.length; i++ ){
		var d = _distances.get( orderedList[i], from );
		if( d <= maxDistance && _factories[orderedList[i]].cyborgs >= minCyborgs ){
			return orderedList[i];
		}
	}
	return -1;
}

function findClosest( list, from ){
	return findClosestMinCyborgs( list, from, 0 );
}

function findClosestMinCyborgs( list, from, minCyborgs ){
	var minDist = 100;
	var closest = -1;
	for( var i=0; i < list.length; i++ ){
		var d = _distances.get( list[i], from );
		if( d < minDist && _factories[list[i]].cyborgs >= minCyborgs ){
			minDist = d;
			closest = list[i];
		}
	}
	return closest;
}

function updateIncomings( object ){
	for( var j=0; j < object.max; j++ ){
		if( object[j+1] ){
			object[j] = object[j+1];
		}
	}
	object[ object.max ] = undefined;
	if( object.max > 0 ){
		object.max--;
	}
}

// Commands functions

function bomb( src, dest ){
	_bombCount--;
	return 'BOMB ' + src + ' ' + dest;
}

function increaseProduction( fid ){
	_factories[fid].cyborgs -= 10;
	return 'INC ' + fid;
}

function move( src, dest, cyborgs ){
	_factories[src].cyborgs -= cyborgs;
	return 'MOVE ' + src + ' ' + dest + ' ' + cyborgs;
}

// Utility functions

function clone( obj ){
	return JSON.parse(JSON.stringify( obj ));
}

function stringify( obj ){
	return JSON.stringify( obj, null, 2 );
}