// Factories
var _factoryCount = parseInt(readline()); // the number of factories
var _factories = {};
var _myFactories, _opFactories, _neutralFactories, _maxEta;

// Links and distances
var _distances = {};
for( var i=0; i < _factoryCount; i++ ){
	_distances[i] = {
		'get': function( id1, id2 ){
			if( id1 < id2 ){ return this[id1][id2]; }
			if( id1 > id2 ){ return this[id2][id1]; }
			return 0;
		}
	};
}
var linkCount = parseInt(readline()); // the number of links between factories
for (var i = 0; i < linkCount; i++) {
    var inputs = readline().split(' ');
    var f1 = parseInt(inputs[0]);
    var f2 = parseInt(inputs[1]);
    var distance = parseInt(inputs[2]);
	_distances[f1][f2] = distance;
}

// game loop
while (true) {
	// Init
	_myFactories = [];
	_opFactories = [];
	_neutralFactories = [];
	_maxEta = 0;
	
	// INPUTS
    var entityCount = parseInt(readline()); // the number of entities (e.g. factories and troops)
    for (var i = 0; i < entityCount; i++) {
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
				_opFactories.push( f.id );
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
			
		}
    }
	
	// ---------- limit inputs storage / outputs compilation ----------
	
	// OUTPUTS
	var actions = [];
	
	simulate( _maxEta );
	
	/* 
	 * Possible actions :
	 *		Support a threatened ally factory
	 *		Attack a neutral factory to capture it
	 *		Attack an enemy factory to capture it
	 *		Send cyborgs to an ally factory so that it can capture close enemies/neutral
	 *		Evacuate a factory when a bomb will hit it
	 *		Refill a bombed factory, the turn after it has been hit
	 *		Increase production
	 */

	if( actions.length === 0 ){
		actions.push('WAIT');
	}
    print( actions.join(';') );
}

// Utility functions

function simulate( nbTurns ){
	var count = 0;
	var factories = JSON.parse(JSON.stringify( _factories ));
	while( count < nbTurns ){
		for( var i=0; i < _factoryCount; i++ ){
			var f = factories[i];
			
			// Move incoming troops
			updateIncomings( f.incomings.allies );
			updateIncomings( f.incomings.enemies );
			
			// Produce new cyborgs
			if( f.owner !== 0 ){
				f.cyborgs += f.production;
			}
			
			// Solve battles
			var incAllies = f.incomings.allies[0] ? f.incomings.allies[0] : 0;
			var incEnemies = f.incomings.enemies[0] ? f.incomings.enemies[0] : 0;
			if( f.owner === 1 ){
				var result = f.cyborgs - ( incEnemies - incAllies );
				if( result < 0 ){
					f.owner = -1;
					f.cyborgs = Math.abs( result );
					printErr('Ally factory [' + f.id + '] falls in ' + (count + 1) + ' turn(s)');
				} else {
					f.cyborgs = result;
				}
			}
			else if( f.owner === -1 ){
				var result = f.cyborgs - ( incAllies - incEnemies );
				if( result < 0 ){
					f.owner = 1;
					f.cyborgs = Math.abs( result );
					printErr('Enemy factory [' + f.id + '] captured in ' + (count + 1) + ' turn(s)');
				} else {
					f.cyborgs = result;
				}
			}
			else {
				var result = f.cyborgs - Math.abs( incAllies - incEnemies );
				if( result < 0 && incAllies > incEnemies ){
					f.owner = 1;
					f.cyborgs = Math.abs( result );
					printErr('Neutral factory [' + f.id + '] captured in ' + (count + 1) + ' turn(s)');
				}
				else if( result < 0 ){
					f.owner = -1;
					f.cyborgs = Math.abs( result );
					printErr('Neutral factory [' + f.id + '] falls in ' + (count + 1) + ' turn(s)');
				}
				else {
					f.cyborgs = result;
				}
			}
		}
		count++;
	}
}

function stringify( obj ){
	return JSON.stringify( obj, null, 2 );
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