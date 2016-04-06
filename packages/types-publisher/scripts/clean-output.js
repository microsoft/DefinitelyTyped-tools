var fs = require('fs');
var path = require('path');
var rmdir = require('rmdir');

var outputPath = path.join(__dirname, '..', 'output');
console.log('Clean ' + outputPath);
fs.readdirSync(function(err, dirs) {
	dirs.forEach(function (dir) {
		rmdir(path.join(outputPath. dir));
	});
});
