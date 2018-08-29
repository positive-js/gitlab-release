const chalk = require('chalk');

const util = require('./util');


module.exports = ui;

function ui(options) {
    const pkg = util.readPkg();
    const oldVersion = pkg.version;

    console.log(`\nPublish a new version of ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);

    return options;
}
