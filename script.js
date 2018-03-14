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
	 *	Support a threatened ally factory
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
						'score': f.production / f.avgDist / f.cyborgs
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
				}
				else {
					f.cyborgs = result;
				}
			}
			
			// TODO: apply bomb explosions !
		}
		simulation[count] = clone( simFactories );
		count++;
	}
	
	// Identify factories which will be neutral or enemy at the end of the simulation
	var _afterSimNeutralFactories = [];
	var _afterSimEnemyFactories = [];
	for( var i=0; i < _factoryCount; i++ ){
		if( simFactories[i].owner === -1 ){
			_afterSimEnemyFactories.push( i );
		}
		else if( simFactories[i].owner === 0 ){
			_afterSimNeutralFactories.push( i );
		}
	}
	
	// Compile attack possibilities of these neutral/enemy factories
	// TODO: implement coordinated attacks from multiple factories
	for( var i=0; i < _myFactories.length; i++ ){
		var mf = _factories[_myFactories[i]];
		for( var j=0; j < _afterSimNeutralFactories.length; j++ ){
			var d = _distances.get( mf.id, _afterSimNeutralFactories[j] );
			if( simulation[d] ){
				var nf = simulation[d][_afterSimNeutralFactories[j]];
				if( mf.cyborgs > nf.cyborgs ){
					possibleActions.push({
						'name': 'capture neutral',
						'actionFactory': mf.id,
						'targetFactory': nf.id,
						'cyborgs': nf.cyborgs + 1,
						'score': nf.production / d / (nf.cyborgs + 1)
					});
				}
			}
		}
		for( var j=0; j < _afterSimEnemyFactories.length; j++ ){
			var d = _distances.get( mf.id, _afterSimEnemyFactories[j] );
			if( simulation[d] ){
				var ef = simulation[d][_afterSimEnemyFactories[j]];
				if( mf.cyborgs > ef.cyborgs + ef.production ){
					possibleActions.push({
						'name': 'attack enemy',
						'actionFactory': mf.id,
						'targetFactory': ef.id,
						'cyborgs': ef.cyborgs + ef.production + 1,
						'score': ef.production / d / (ef.cyborgs + ef.production + 1)
					});
				}
			}
		}
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
					'score': f.production
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
						'score': ef.production / ef.avgDist
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
				'score': 1 / 10
			});
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
	var actionableFactories = _myFactories.slice();
	var handledTargets = [];
	while( actionableFactories.length > 0 && possibleActions.length > 0 ){
		var a = possibleActions.shift();
		switch( a.name ){
			case 'attack enemy':
			case 'capture neutral':
				if( handledTargets.indexOf( a.targetFactory ) < 0 ){
					// Better split the cyborgs, if not too risky
					var nbCyborgs = a.name === 'capture neutral' ? Math.max( a.cyborgs, Math.floor(_factories[a.actionFactory].cyborgs / 2) ) : a.cyborgs;
					// Move command
					actions.push( move( a.actionFactory, a.targetFactory, nbCyborgs ) );
					// Remove actionFactory from actionables
					if( _factories[a.actionFactory].cyborgs === 0 ){
						actionableFactories.splice( actionableFactories.indexOf( a.actionFactory ), 1 );
					}
					// Mark target factory handled
					handledTargets.push( a.targetFactory );
				}
				break;

			case 'bomb enemy':
				// Find closest factory
				var actionFactory = findClosestMinCyborgs( actionableFactories, a.targetFactory, 0 );
				if( actionFactory >= 0 ){
					// Bomb command
					actions.push( bomb( actionFactory, a.targetFactory ) );
					// Remove actionFactory from actionables
					actionableFactories.splice( actionableFactories.indexOf( actionFactory ), 1 );
				}
				break;

			case 'evacuate':
				// Find closest ally to transfer the cyborgs
				var myOtherFactories = _myFactories.slice();
				myOtherFactories.splice( myOtherFactories.indexOf( a.actionFactory ), 1 );
				var targetFactory = findClosest( myOtherFactories, a.actionFactory );
				// Move command
				actions.push( move( a.actionFactory, targetFactory, a.cyborgs ) );
				// Remove actionFactory from actionables
				actionableFactories.splice( actionableFactories.indexOf( a.actionFactory ), 1 );
				break;

			case 'increase production':
				// Move command
				actions.push( increaseProduction( a.actionFactory ) );
				// Remove actionFactory from actionables
				if( _factories[a.actionFactory].cyborgs === 0 ){
					actionableFactories.splice( actionableFactories.indexOf( a.actionFactory ), 1 );
				}
				break;

			case 'reinforced bombed ally':
				// TODO!
				break;

			case 'support ally':
				// Find ally actionable factory at distance <= turnsEffect which has enough cyborgs to support
				var otherFactories = actionableFactories.slice();
				var iotf = otherFactories.indexOf( a.targetFactory );
				if( iotf >= 0 ){
					otherFactories.splice( iotf, 1 );
				}
				var actionFactory = findMaxDistanceMinCyborgs( otherFactories, a.targetFactory, a.turnsEffect, a.cyborgs );
				if( actionFactory >= 0 ){
					// Move command
					actions.push( move( actionFactory, a.targetFactory, a.cyborgs ) );
					// Remove actionFactory from actionables
					if( _factories[actionFactory].cyborgs === 0 ){
						actionableFactories.splice( actionableFactories.indexOf( actionFactory ), 1 );
					}
				}
				// TODO: else, find multiple actionable factories to support the needed amount
				break;
		}
	}

	// Print actions
	if( actions.length === 0 ){
		actions.push('WAIT');
	}
    print( actions.join(';') );
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