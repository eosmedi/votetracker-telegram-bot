var fs = require('fs');
var BASE_DIR = __dirname+'/database/';

if(!fs.existsSync(BASE_DIR)){
    fs.mkdirSync(BASE_DIR);
}

var config = {
    database: {
        bot_watcher: BASE_DIR+'bot_watcher.json',
    }
};

module.exports = config;

