const meow = require('meow');
const logSymbols = require('log-symbols');

const getLogger = require('./lib/get-logger');
const ui = require('./lib/ui');
const gitlabRelease = require('.');


const cli = meow(`
    Usage

    Options
      --built-type  Build Type
    Examples
      $ echo
`, {
    flags: {
        buildType: {
            type: 'string'
        }
    }
});

const context = {
    cwd: process.cwd(),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr
};

const logger = getLogger(context);

process.on('SIGINT', () => {
    logger.log('\nAborted!');
    process.exit(1);
});

Promise
    .resolve()
    .then(() => {

        return ui(cli.flags);
    })
    .then(options => gitlabRelease(options, { logger } ))
    .catch(err => {
        logger.error(`\n${logSymbols.error} ${err.message}`);
        process.exit(1);
    });
