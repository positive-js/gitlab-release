const fs = require('fs');
const exec = require('child_process').exec;
const conventionalChangelog = require('conventional-changelog');
const getSubject = require('./util').getSubject;


module.exports = releaseNotesGenerator;


function prependDelta() {
    // don`t remove CHANGELOG-delta.md, we need it for e-mail notifications
    exec('cat CHANGELOG-delta.md CHANGELOG.md > CHANGELOG-new.md;' +
        'mv CHANGELOG-new.md CHANGELOG.md;');
}

function trim($) {
    $('body>p').remove();
}

function customizeHeader($, header, config) {
    const link = $(header).find('a');
    const urlVersion = link.attr('href').replace('…', '...');

    return $(`<span class="header">${getSubject(config)}</span>
        <br/>
        <a class="diff" href="${urlVersion}">Сравнить</a>
        <br/><br/>`);
}

function customizeScope($, scope) {
    const text = $(scope).text();

    return $(`<span class="type">${text}</span>
        <br/><br/>`);
}

function list2table($, list) {
    const table = $('<table border="0" cellpadding="0" cellspacing="0" class="items">');

    $(list).find('li').each((i, item) => {
        const scope = $(item).find('strong').text().replace(/:/, '');
        $(item).find('strong').remove();

        const linkTask = $(item).find(`a[href^='${process.env.npm_package_issues}']`);
        const linkCommit = $(item).find(`a[href^='${process.env.npm_package_bugs_url}']`);
        linkTask.text(`task ${linkTask.text()}`);
        linkCommit.text(`commit ${linkCommit.text()}`);

        const subject = $(item).html();

        const tr = $(`<tr>
            <td valign="top" class="scope">${scope}</td>
            <td valign="top" class="subject">${subject}</td>
        </tr>`);

        $(table).append(tr);
    });

    if ($(table).find('td.scope:empty').length === $(table).find('td.scope').length) {
        $(table).find('td.scope').remove();
    }

    return table;
}

function releaseNotesGenerator(config) {
    // See documentation: https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/gulp-conventional-changelog
    const options = {preset: 'angular', releaseCount: 1};
    const context = {
        version: config.nextVersion,
        previousTag: config.currentVersion,
        currentTag: config.nextVersion
    };
    const gitRawCommitsOpts = {};
    const parserOpts = {};
    const writerOpts = {
        transform: (commit, context) => {

            const allowTypes = {
                feat: 'Features',
                fix: 'Bug Fixes',
                build: 'Build',
                perf: 'Performance Improvements',
                revert: 'Reverts',
                docs: 'Documentation',
                style: 'Styles',
                refactor: 'Code Refactoring',
                test: 'Tests',
                chore: 'Chores'
            };

            const modifiedType = allowTypes[commit.type];

            if (modifiedType === undefined) {
                return;
            }

            commit.type = modifiedType;

            commit.notes.forEach((note) => {
                note.title = 'BREAKING CHANGES';
            });

            if (commit.scope === '*') {
                commit.scope = '';
            }

            if (typeof commit.hash === 'string') {
                commit.hash = commit.hash.substring(0, 7);
            }

            if (typeof commit.subject === 'string') {
                commit.subject = commit.subject.substring(0, 120);

                var url = context.packageData.issues;

                if (url) {
                    url = url + '?_a=edit&id=';
                    // Issue URLs.
                    commit.subject = commit.subject.replace(/#([0-9]+)/g, function(_, issue) {
                        return '[#' + issue + '](' + url + issue + ')';
                    });
                }

                if (context.host) {
                    // User URLs.
                    commit.subject = commit.subject.replace(
                        /\B@([a-z0-9](?:-?[a-z0-9]){0,38})/g,
                        '[@$1](' + context.host + '/$1)'
                    );
                }
            }

            commit.references = null;

            return commit;
        }
    };

    const changelogStream = fs.createWriteStream('CHANGELOG-delta.md');

    return new Promise((resolve, reject) => {
        conventionalChangelog(
            options,
            context,
            gitRawCommitsOpts,
            parserOpts,
            writerOpts
        )
            .pipe(changelogStream)
            .on('error', (err) => {
                console.log(`Failed to generate changelog: ${err}`);
                reject(err);
            })
            .on('close', () => {
                prependDelta();

                setTimeout(() => {

                    const showdown = require('showdown');
                    const inlineCss = require('inline-css');

                    const converter = new showdown.Converter();

                    const text = fs.readFileSync('CHANGELOG-delta.md', 'utf-8');
                    const md = converter.makeHtml(text);

                    const template = fs.readFileSync('lib/changelog.html', 'utf-8');

                    const cheerio = require('cheerio');
                    const $ = cheerio.load(template);

                    $('.content').append(md);

                    trim($);

                    $('h2').each((i, header) => {
                        $(header).replaceWith(customizeHeader($, header, config));
                    });

                    $('h3').each((i, header) => {
                        $(header).replaceWith(customizeScope($, header));
                    });

                    $('ul').each((i, list) => {
                        $(list).replaceWith(list2table($, list));
                    });

                    inlineCss($.html(), {url: './'})
                        .then((html) => {
                            fs.writeFileSync('changelog.html', html, 'utf-8');
                        });


                    resolve();
                }, 2000);
            });
    });
}
