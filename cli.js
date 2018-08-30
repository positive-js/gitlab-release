const meow = require('meow');
const logSymbols = require('log-symbols');
const updateNotifier = require('update-notifier');

const getLogger = require('./lib/get-logger');
const ui = require('./lib/ui');
const gitlabRelease = require('.');


const cli = meow(`
    Usage
        $

    Options
      --built-type, -bt    Build Type
      --git-host,   -gh    'gitlab.domain.com/{group-name}/{project-name}.git';

    Examples
      $ echo
`, {
    flags: {
        gitHost: {
            type: 'string',
            alias: 'gh'
        },
        buildType: {
            type: 'string',
            alias: 'bt'
        }
    }
});

updateNotifier({pkg: cli.pkg}).notify();

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
    .then(options => {
        if (!options.gitHost) {
            logger.error(`Must set "--git-host" option`);
            process.exit(0);
        }

        return options;
    })
    .then(options => gitlabRelease(options, { logger } ))
    .catch(err => {
        logger.error(`\n${logSymbols.error} ${err.message}`);
        process.exit(1);
    });
