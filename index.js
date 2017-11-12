/**
 * Polyfill: Record + Hide any console.log output by twig.js module for later use with custom handler.
 */
(function polyfillExtractHideDebugTwigJs() {

    const oldConsoleLog = console.log;

    let logs = [];
    let tokenReferences = [];
    let fileReferences = [];

    global.console.log = function () {


        logs.push(arguments[0]);


        //console.warn(arguments);

        var getStackTrace = function () {
            var obj = {};
            Error.captureStackTrace(obj, getStackTrace);
            return obj.stack;
        };


        const x = getStackTrace();


        //console.warn("spacecms.js: (139)",);//fordebug: debug print

        //oldConsoleLog("spacecms.js:log (32)",arguments[0]);//fordebug: debug print

        //oldConsoleLog(x);


        if (x.indexOf("twig.js:") <= -1) {
            Array.prototype.unshift.call(arguments);
            oldConsoleLog.apply(this, arguments);

        } else {


            const stringOut = JSON.stringify(arguments[0]);
            // console.warn("spacecms.js:stringout (44)",stringOut);//fordebug: debug print

            if (stringOut.indexOf('space.') > -1 && stringOut.indexOf("Tokenizing expression ") > -1) {

                const objectExpression = arguments[0][arguments[0].length - 1];
                tokenReferences.push(objectExpression);

            }
            //oldConsoleLog("spacecms.js:stringout (49)",stringOut);//fordebug: debug print
            if (stringOut.indexOf("Twig.Template.reset") > -1) {
                const fileExpression = arguments[0];
                //oldConsoleLog("spacecms.js:fil (49)",);//fordebug: debug print

                fileReferences.push(fileExpression[fileExpression.length - 1].split('Reseting template ')[1]);

            }

        }
    };


    global.debugReset = function () {
        logs = [];
        tokenReferences = [];
        fileReferences = [];
    };

    /**
     * Get last object expression that was printed as error in twig.js debug output.
     */
    global.debugGetLastTwigExpressionOut = function () {

        try {

            const vals = logs[logs.length - 1][logs[logs.length - 1].length - 1];
            let m = [];


            if (!vals.length || !vals[0].type) return false;

            vals.forEach(function (k) {

                switch (k.type) {
                    case "Twig.expression.type.variable":
                        m.push(k.value);
                        break;
                    case "Twig.expression.type.key.period":
                        m.push("." + k.key);
                        break;
                    case "Twig.expression.type.key.brackets":
                        m.push("[x]");
                        break;
                    case "Twig.expression.type.filter":
                        m.push(" | " + k.match[1]);
                        break;

                    default:
                        spacelog("Unrecognised type:", k.type);
                        break;
                }

            });


            return m.join('');

        } catch (err) {
            //todo: handle better
            return false;
        }

    };

    global.debugGetLastFileReference = function () {
        return fileReferences.length ? fileReferences[fileReferences.length - 1] : false;
    };
    global.debugGetTwigTokenObjectReferences = function (space) {

        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }


        let m = tokenReferences.filter(onlyUnique);


        var getValueFromRef = function (ref) {
            try {
                return eval(ref);
            } catch (err) {
                //console.warn("failed get value for ref:", ref, err);
                return undefined;
            }
        };

        m = m.map(function (ref) {
            const start = ref.indexOf('space.');
            const end = ref.indexOf(' ', start) > -1 ? ref.indexOf(' ', start) : ref.length;
            const name = ref.substr(start, end);


            return {
                ref: name,
                val: function () {

                    return getValueFromRef(name);

                }()
            };
        });

        m.forEach(function (objectToken) {

            if (typeof objectToken.val === "undefined") {
                const refParts = objectToken.ref.split('.');


                const lastParentSpecified = function () {

                    for (let i = refParts.length - 1; i >= 0; i--) {
                        const refPart = refParts[i];

                        const fullRef = refParts.slice(0, i + 1).join('.');


                        const v = getValueFromRef(fullRef);

                        if (typeof v !== "undefined") {
                            return {
                                ref: fullRef,
                                val: v
                            };
                        }


                    }
                    return undefined;

                }();

                if (typeof lastParentSpecified !== "undefined") {

                    const printUndefinedMessage = function () {

                        let invalidProps = objectToken.ref.replace(lastParentSpecified.ref, '');

                        //remove dot at start if exists
                        invalidProps = invalidProps[0] === "." ? invalidProps.substr(1) : invalidProps;

                        spacelog(chalk.red("Twig Error: " + "Undefined Properties Found"));

                        gutil.log("\t", chalk.gray(objectToken.ref.replace(invalidProps, chalk.underline.red(invalidProps))));

                        const getRefKeys = function (validObject) {

                            let m = [];

                            for (let key in validObject) {
                                if (!validObject.hasOwnProperty(key)) continue;
                                m.push({ref: key, val: validObject[key]});
                            }

                            return m;
                        };
                        var shortenText = function (text) {
                            if (typeof text === "string")
                                return text.substr(0, 40) + (text.length > 40 ? '...' : '');

                            return text;
                        };

                        gutil.log("\t", chalk.blue("Available Properties"));

                        getRefKeys(lastParentSpecified.val).forEach(function (reco) {

                            //console.log("spacecms.js:objectTokenref (198)",reco.ref,objectToken.ref);//fordebug: debug print
                            gutil.log("\t", chalk.gray(objectToken.ref
                                    .replace(
                                        invalidProps, chalk.blue(reco.ref)
                                        , objectToken.ref.indexOf(lastParentSpecified.ref)
                                    )//replace
                                )//chalk.gray
                                ,
                                chalk.bold.gray(reco.val === null ? "NULL" : (typeof (reco.val)).toUpperCase())
                                ,
                                chalk.gray(
                                    shortenText(
                                        function outputObjectTokenValToString() {
                                            switch (typeof reco.val) {
                                                case "object":
                                                    return JSON.stringify(reco.val);
                                                    break;

                                                default:
                                                    return reco.val;
                                                    break;
                                            }
                                        }()
                                    )//shortenText
                                )//chalk.gray

                            );//log
                        });


                    }();//printUndefinedMessage


                } else {
                    //todo: handle when space not defined?
                }

            } else {

                //Value is specified and ok.

            }
        });
    }

})();

const axios = require('axios');
const chalk = require('chalk');
const twig = require('twig');
const chokidar = require('chokidar');
const fse = require('fs-extra');
const path = require('path');
const program = require('commander');
const ora = require('ora');
const glob = require('glob');


(function customizeLog() {//brand namespace

    const originalLog = console.log;

    global.log = function () {

        const mainArguments = [].slice.call(arguments).map(function (item) {
            return chalk.cyan(item);
        });

        mainArguments.unshift(chalk.bold.bgCyan("TwigCMS"));

        return originalLog.apply(this, mainArguments);
    };

})();


program
// .command('[Build Directory],index [Build Directory]', 'Compile all Twig files within a project',{isDefault: true})
//.usage('[options] <source> <destination>')
    .description("Compile Twig Files using TwigCMS API")
    //.option('-w, --watch', 'Watch Twig files for changes and recompile to build directory')
    //.option('-w, --watch', 'Watch Twig files for changes and recompile to build directory')
    .option('-s, --source [directory]', 'Directory which Twig files reside in')
    .option('-d, --destination [directory]', 'Destination of compiled twig files')
    .option('-p, --project [project name]', 'Project name')
    // .option('-m, --minify', 'Minify HTML Output (Remove unnecessary spaces and tabs etc.)')
    .option('-h, --host [host]', 'TwigCMS Host (For developer use)', "http://portal.firepit.tech/")
    .parse(process.argv);


/*

const watcher = chokidar.watch('file', {
    ignored: [
        '_*'
        , '**!/!*.inc.twig'
        , /(^|[\/\\])\../
        , '**node_modules/!**'
        , program.destination
    ]
    , persistent: true
    , cwd: '.'
    , depth: 99
});

watcher.add(path.join(program.source, '**!/!*.twig'));

watcher.on('addDir', path => log(`Directory ${path} has been added`))
    .on('unlinkDir', path => log(`Directory ${path} has been removed`))
    .on('error', error => log(`Watcher error: ${error}`))
    //.on('ready', () => log('Initial scan complete. Ready for changes'))
    .on('error', function (error) {
        console.error('Error happened', error);
    })
    .on('raw', (event, path, details) => {
        // log('Raw event info:', event, path, details);
    })
    .on('add', path => compileTwig(path))
    .on('change', path => compileTwig(path));
*/

const spinner = [];

const twigRenderFile = function (filePath, data) {
    return new Promise(function (resolve, reject) {
        twig.renderFile(filePath, data, function (err, html) {

            if (err) {
                reject(err);
                return;
            }
            resolve(html);


        });
    });
};


const getStdOut = function (text) {
    return chalk.bold.bgCyan("TwigCMS") + " " + text;
};


const compileTwig = function (filePath, data) {

    const relOut = path.relative(program.source, filePath);

    let out = path.join(
        program.destination
        , relOut
        //,path.parse(filePath).name.split('.')[0]+".html"
    );

    //replace .html.twg, .inc.twig, .twig -> .html
    out = out.replace(path.basename(out), path.basename(out).split('.')[0] + ".html");


    if (!spinner[relOut])
        spinner[relOut] = ora().render();

    spinner[relOut].start("Compiling: " + relOut);

    return twigRenderFile(filePath, data).then(function (html) {

        if (path.basename(out)[0] !== "_") {


            return fse.outputFile(out, html).then(function () {

                return out;


            });
        } else {
            return true;
        }

    }).then(function () {
        //log("Compiled file:",out);

        const dest = chalk.grey(path.normalize(program.destination)+(program.destination[program.destination.length-1]==="/"?"":"/"));
        spinner[relOut].succeed(chalk.green("Compiled") + ": " + dest + relOut);

        return true;

    });

};


if (!program.host)
    program.host = "http://portal.firepit.tech/";

const errorSuffix = "(Use argument --help for more info)";


if (!program.source)
    return log(chalk.red("Please specify a source directory", errorSuffix));

if (!program.destination)
    return log(chalk.red("Please specify a destination directory", errorSuffix));

if (!program.project)
    return log(chalk.red("Please specify a project name", errorSuffix));





fse.removeSync(program.destination);



const apiURL = "http://" + path.join(path.parse(program.host).base, "project", program.project, "spaces");

console.log(getStdOut("Loading URL: "+chalk.grey(apiURL)));

const loadAPISpinner = ora("Loading Space Data... " + chalk.grey(apiURL)).start();

axios.get(apiURL).then(function (response) {

    loadAPISpinner.stop();

    const data = Object.assign({space: response.data});

    glob(path.join(program.source, '**/*.twig'), function (err, twigFiles) {
        Promise.all(twigFiles.map(function (twigFile) {
            return compileTwig(twigFile, data);
        })).then(function () {
            log("Compiled all Twig Files!");
            process.exit();
        });
    });
}).catch(function (err) {

    loadAPISpinner.fail("Failed to load from API: " + apiURL);
});

//chokidar.watch(path.join("./"),function({}))