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

context.logger = getLogger(context);

process.on('SIGINT', () => {
    context.logger.log('\nAborted!');
    process.exit(1);
});

Promise
    .resolve()
    .then(() => {

        return ui(cli.flags);
    })
    .then(options => gitlabRelease(options, context.logger))
    .catch(err => {
        context.logger.error(`\n${logSymbols.error} ${err.message}`);
        process.exit(1);
    });
