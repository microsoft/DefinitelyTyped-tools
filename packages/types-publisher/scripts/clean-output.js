var fs = require('fs');
var path = require('path');
var rmdir = require('rmdir');

var outputPath = path.join(__dirname, '..', 'output');
console.log('Clean ' + outputPath);
fs.readdir(outputPath, function(err, dirs) {
	if(dirs) {
		dirs.forEach(function (dir) {
			var p = path.join(outputPath, dir);
			rmdir(p);
		});
	}
});
