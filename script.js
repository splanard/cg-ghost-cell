var factoryCount = parseInt(readline()); // the number of factories
var linkCount = parseInt(readline()); // the number of links between factories
for (var i = 0; i < linkCount; i++) {
    var inputs = readline().split(' ');
    var factory1 = parseInt(inputs[0]);
    var factory2 = parseInt(inputs[1]);
    var distance = parseInt(inputs[2]);
}

// game loop
while (true) {
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
    }

    // Write an action using print()
    // To debug: printErr('Debug messages...')

    // Any valid action, such as "WAIT" or "MOVE source destination cyborgs"
    print('WAIT');
}