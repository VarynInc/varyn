/**
 * NOTE: This is a placeholder and it does not work! Someone needs to implement this script before it can be used.
 * Build the website. This module supports the following tasks:
 *   - optimize images (in place)
 *   - minify and combine ./public/common/*.js
 * @author: jf
 * @date: 14-Dec-2019
 */
const os = require("os");
const path = require("path");
const async = require("async");
const glob = require("glob");
const rename = require("gulp-rename");
const chalk = require("chalk");
const prettyBytes = require("pretty-bytes");
const ImageMin = require("imagemin");
const UglifyJS = require("uglify-js");
const fsExtra = require('fs-extra');

// Local module variables
const numberOfCPUs = os.cpus().length;
var compressionStats = {
    totalFiles: 0,
    totalBytesConsidered: 0,
    totalBytesCompressed: 0,
    startTime: new Date(),
    endTime: null
};

// Configurable parameters:
var configuration = {
    isLoggingInfo: true,
    isLoggingError: true,
    isOptimizingImages: false,
    packageName: "inteligencia.min.js",
    sourceFolder: "./public/common",
    destinationFolder: "./public/common",
    copyToFolder: null,
    imagesFileSpec: "{jpg,jpeg,png,gif}",
    unoptimizedFileSpec: "{eot,ttf,woff,woff2,svg,mp3,ogg,wav,json}",
    pageManifest: {
        about: [
            "varyn.js"
        ],
        allgames: [
            "varyn.js",
            "varynAllGamesPage.js"
        ],
        blog: [
            "varynBlog.js"
        ],
        play: [
            "varyn.js",
            "varynPlayPage.js"
        ],
        profile: [
            "varyn.js",
            "varynProfilePage.js"
        ],
        resetPassword: [
            "varyn.js",
            "varynResetPasswordPage.js"
        ]
    },
    libManifest: [
        "modernizr.js",
        "jquery.min.js",
        "bootstrap.min.js",
        "ie10-viewport-bug-workaround.js",
        "enginesis.js",
        "ShareHelper.js",
        "commonUtilities.js"
    ],
    filesToCopy: [ // a list of files to copy to destination without modification
    ],
    jsFilesToIgnore: [ // a list of files in the js folder to skip
    ],
    libsToCopy: [
        "head.min.js",
        "modernizr.js",
        "createjs.min.js",
        "jquery.min.js",
        "screenfull.min.js"
    ],
    libsToCombine: [
        "commonUtilities.js",
        "ShareHelper.js",
        "enginesis.js"
    ],
    combinedLibFileName: "enginesis.min.js"
};


/**
 * Helper function to control logging.
 * @param message
 */
function logInfo(message) {
    if (configuration.isLoggingInfo) {
        console.log(message);
    }
}
/**
 * Helper function to control logging.
 * @param message
 */
function logError(message) {
    if (configuration.isLoggingError) {
        console.warn(chalk.red("ᚎ " + message));
    }
}

/**
 * Capture any command line arguments and update configuration variables.
 */
function getCommandLineArguments() {
    var args = process.argv;
    // var node = args[0];
    // var script = args[1];
    var i;
    var option;

    for (i = 2; i < args.length; i++) {
        option = args[i];
        switch (option) {
            case "-i":
            case "--optimizeImages":
                configuration.isOptimizingImages = true;
                break;
            case "-l":
            case "--log":
                configuration.isLoggingInfo = false;
                configuration.isLoggingError = true;
                break;
            case "-c":
            case "--copy":
                configuration.copyToFolder = args[i + 1];
                break;
            case "-?":
            case "--help":
                showHelp();
                break;
            default:
                if (option[0] == "-") {
                    console.log("Unhandled option " + option);
                }
                break;
        }
    }
}

/**
 * Display on the console all possible command line options.
 */
function showHelp() {
    console.log(chalk.yellow("??? Build options:"));
    console.log(chalk.yellow("    -?, --help:           show options"));
    console.log(chalk.yellow("    -i, --optimizeImages: optimize image files"));
    console.log(chalk.yellow("    -l, --log:            turn off logging messages"));
    console.log(chalk.yellow("    -c, --copy {path}:    copy result /distrib folder to specified path"));
    process.exit();
}

/**
 * Optimize all image files found in sourcePath and copy the optimized version to destinationPath.
 * @param sourcePath {string} path to the root folder under which to find images. Image files are jpg, jpeg, png, gif, svg.
 * @param destinationPath {string} path where to copy optimized files.
 * @param imagesGlobSpec {string} which fie extensions to copy.
 */
function optimizeImages(sourcePath, destinationPath, imagesGlobSpec) {
    logInfo(chalk.green("ᗘ Starting image optimization"));
    var globSpec = path.join(sourcePath, "/**/") + "*." + imagesGlobSpec;
    var sourcePathLength = sourcePath.length;
    var totalBytesConsidered = 0;
    var totalBytesCopied = 0;
    var totalFilesCopied = 0;
    var imageMinOptions = {
        progressive: true,
        interlaced: true,
        optimizationLevel: 3
    };

    return new Promise(function (resolve, reject) {
        glob(globSpec, function (error, files) {
            async.eachLimit(files, numberOfCPUs, function (file, next) {
                var destinationFile = path.join(destinationPath, file.substr(sourcePathLength));
                var imageMin = new ImageMin()
                    .src(file)
                    .dest(path.dirname(destinationFile))
                    .use(ImageMin.jpegtran(imageMinOptions))
                    .use(ImageMin.optipng(imageMinOptions))
                    .use(ImageMin.gifsicle(imageMinOptions));
                if (imageMinOptions.use) {
                    imageMinOptions.use.forEach(imageMin.use.bind(imageMin));
                }
                if (path.basename(file) !== path.basename(destinationFile)) {
                    imageMin.use(rename(path.basename(destinationFile)));
                }
                fsExtra.stat(file, function (error, fileStat) {
                    if (error) {
                        logError(file + " -- fstat error " + error.toString());
                        return next();
                    }
                    totalFilesCopied++;
                    imageMin.run(function (error, imageData) {
                        if (error) {
                            logError(file + " -- imagemin error " + error.toString());
                            return next();
                        }
                        var statusMessage;
                        var originalFileSize = fileStat.size;
                        var optimizedFileSize = imageData[0].contents.length;
                        var bytesSaved = originalFileSize - optimizedFileSize;
                        totalBytesConsidered += originalFileSize;
                        totalBytesCopied += optimizedFileSize;
                        if (bytesSaved > 9) {
                            statusMessage = "saved " + prettyBytes(bytesSaved) + " (" + ((optimizedFileSize / originalFileSize) * 100).toFixed() + "%)";
                        } else {
                            statusMessage = "is optimized";
                        }
                        logInfo(chalk.green("ᗘ ") + chalk.gray(file + " -- copy to " + destinationFile) + " -- " + statusMessage);
                        process.nextTick(next);
                    });
                });
            }, function (error) {
                compressionStats.totalFiles += totalFilesCopied;
                compressionStats.totalBytesConsidered += totalBytesConsidered;
                compressionStats.totalBytesCompressed += totalBytesCopied;
                compressionStats.endTime = new Date();
                if (error) {
                    reject(new Error("optimizeImages process error " + error.toString()));
                } else {
                    var totalSaved = totalBytesConsidered - totalBytesCopied;
                    var percentSaved = totalBytesConsidered == 0 ? 0 : ((totalSaved / totalBytesConsidered) * 100).toFixed() + "%";
                    logInfo(chalk.green("ᙘ Completed image optimization for " + totalFilesCopied + " files, saved " + prettyBytes(totalSaved) + " " + percentSaved));
                    resolve();
                }
            });
        });
    });
}

/**
 * Copy images without optimizing them.
 * @param sourcePath {string} path to the root folder under which to find images. Image files are jpg, jpeg, png, gif, svg.
 * @param destinationPath {string} path where to copy optimized files.
 * @param imagesGlobSpec {string} which fie extensions to copy.
 */
function copyImages(sourcePath, destinationPath, imagesGlobSpec) {
    logInfo(chalk.green("ᗘ Starting image copy"));
    var globSpec = path.join(sourcePath, "/**/") + "*." + imagesGlobSpec;
    var sourcePathLength = sourcePath.length;
    var totalBytesConsidered = 0;
    var totalBytesCopied = 0;
    var totalFilesCopied = 0;

    return new Promise(function (resolve, reject) {
        glob(globSpec, function (error, files) {
            async.eachLimit(files, numberOfCPUs, function (file, next) {
                var destinationFile = path.join(destinationPath, file.substr(sourcePathLength));
                fsExtra.stat(file, function (error, fileStat) {
                    var newPath = path.dirname(destinationFile);
                    var originalFileSize;
                    if (error) {
                        logError(file + " -- fstat error " + error.toString());
                        return next();
                    }
                    if (!fsExtra.existsSync(newPath)) {
                        fsExtra.mkdirSync(newPath);
                    }
                    fsExtra.copyFileSync(file, destinationFile);
                    totalFilesCopied++;
                    originalFileSize = fileStat.size;
                    totalBytesConsidered += originalFileSize;
                    totalBytesCopied += originalFileSize;
                    logInfo(chalk.green("ᗘ ") + chalk.gray(file + " -- copy to " + destinationFile));
                    process.nextTick(next);
                });
            }, function (error) {
                compressionStats.totalFiles += totalFilesCopied;
                compressionStats.totalBytesConsidered += totalBytesConsidered;
                compressionStats.totalBytesCompressed += totalBytesCopied;
                compressionStats.endTime = new Date();
                if (error) {
                    reject(new Error("copyImages process error " + error.toString()));
                } else {
                    logInfo(chalk.green("ᙘ Completed image copy for " + totalFilesCopied + " files, total " + prettyBytes(totalBytesCopied)));
                    resolve();
                }
            });
        });
    });
}

/**
 * Optimize all js files found in sourcePath and copy the optimized version to destinationPath.
 * @param sourcePath {string} path to the root folder under which to find js files.
 * @param destinationPath {string} path where to copy optimized files.
 */
function optimizeJS(sourcePath, destinationPath, packageName) {
    logInfo(chalk.green("ᗘ Starting JavaScript optimization for app files"));
    var globSpec = path.join(sourcePath, "*.js");
    var totalBytesConsidered = 0;
    var totalBytesCopied = 0;
    var uglifyJSCode = {};
    var uglifyJSOptions = {
        warnings: true,
        toplevel: false,
        compress: {},
        mangle: {}
    };

    function compressJSFile(file) {
        var fileName = path.basename(file);
        var fileSize;
        var fileContents;
        if (configuration.jsFilesToIgnore.indexOf(fileName) < 0) {
            fileContents = fsExtra.readFileSync(file, { encoding: "utf8", flag: "r" });
            if (fileContents != null && fileContents.length > 0) {
                compressionStats.totalFiles++;
                fileSize = Buffer.byteLength(fileContents);
                totalBytesConsidered += fileSize;
                compressionStats.totalBytesConsidered += fileSize;
                uglifyJSCode[fileName] = fileContents;
            } else {
                logError("Error reading js file " + file);
            }
        }
    }

    function completeJSCompression(packageName) {
        var destinationFile = path.join(destinationPath, packageName);
        var uglifyJSResult = UglifyJS.minify(uglifyJSCode, uglifyJSOptions);
        if (uglifyJSResult != null && typeof uglifyJSResult.code !== "undefined" && uglifyJSResult.code !== null) {
            if (!fsExtra.existsSync(destinationPath)) {
                fsExtra.mkdirSync(destinationPath);
            }
            fsExtra.writeFileSync(destinationFile, uglifyJSResult.code);
            totalBytesCopied = Buffer.byteLength(uglifyJSResult.code);
            compressionStats.totalBytesCompressed += totalBytesCopied;
            var bytesSaved = totalBytesConsidered - totalBytesCopied;
            var statusMessage;
            if (bytesSaved > 9) {
                statusMessage = "JS compression saved " + prettyBytes(bytesSaved) + " (" + ((bytesSaved / totalBytesConsidered) * 100).toFixed() + "%)";
            } else {
                statusMessage = "JS is optimized";
            }
            logInfo(chalk.green("ᗘ ") + chalk.gray("JS compressed to " + destinationFile) + " -- " + statusMessage);
        } else {
            logError("completeJSCompression something wrong with uglifyJS " + uglifyJSResult.error);
        }
    }

    return new Promise(function (resolve, reject) {
        if (typeof configuration.appManifest === "undefined" || configuration.appManifest == null || configuration.appManifest.length == 0) {
            glob(globSpec, function (error, files) {
                if (error != null) {
                    return reject(error);
                } else {
                    files.forEach(compressJSFile);
                    completeJSCompression(packageName);
                    return resolve();
                }
            });
        } else {
            configuration.appManifest.forEach(function (file) {
                file = path.join(sourcePath, file);
                compressJSFile(file);
            });
            completeJSCompression(packageName);
            return resolve();
        }
    });
}

/**
 * Create the libraries.
 * @param sourcePath {string} path to the root folder under which to find js files.
 * @param destinationPath {string} path where to copy optimized files.
 */
function optimizeJSLibs(sourcePath, destinationPath) {
    logInfo(chalk.green("ᗘ Starting JavaScript optimization for libs"));
    var totalBytesConsidered = 0;
    var uglifyJSCode = {};
    var uglifyJSOptions = {
        warnings: true,
        toplevel: false,
        compress: {},
        mangle: {}
    };

    return new Promise(function (resolve, reject) {
        fsExtra.ensureDir(destinationPath)
            .then(function () {
                async.map(configuration.libsToCopy, function (file) {
                    var fileName = path.join(sourcePath, file);
                    fsExtra.stat(fileName, function (error, fileStat) {
                        if (error) {
                            throw (new Error("optimizeJSLibs fstat error -- " + fileName + ":  " + error.toString()));
                        } else {
                            var destinationFile = path.join(destinationPath, file);
                            var originalFileSize = fileStat.size;
                            fsExtra.copyFileSync(fileName, destinationFile);
                            logInfo(chalk.green("ᗘ ") + chalk.gray(fileName + " -- copied to " + destinationFile));
                            compressionStats.totalFiles++;
                            compressionStats.totalBytesConsidered += originalFileSize;
                            compressionStats.totalBytesCompressed += originalFileSize;
                        }
                    });
                }, function (error, result) {
                    if (error != null) {
                        return reject(error);
                    } else {
                        return result;
                    }
                });
            })
            .then(function (result) {
                var destinationFile = path.join(destinationPath, configuration.combinedLibFileName);
                configuration.libsToCombine.forEach(function (file) {
                    var fileName = path.join(sourcePath, file);
                    var fileSize;
                    var fileContents = fsExtra.readFileSync(fileName, { encoding: "utf8", flag: "r" });
                    if (fileContents != null && fileContents.length > 0) {
                        compressionStats.totalFiles++;
                        fileSize = Buffer.byteLength(fileContents);
                        compressionStats.totalBytesConsidered += fileSize;
                        totalBytesConsidered += fileSize;
                        uglifyJSCode[file] = fileContents;
                    }
                });
                var uglifyJSResult = UglifyJS.minify(uglifyJSCode, uglifyJSOptions);
                fsExtra.writeFileSync(destinationFile, uglifyJSResult.code);
                var totalBytesCopied = Buffer.byteLength(uglifyJSResult.code);
                compressionStats.totalBytesCompressed += totalBytesCopied;
                var bytesSaved = totalBytesConsidered - totalBytesCopied;
                var statusMessage;
                if (bytesSaved > 9) {
                    statusMessage = "JS compression saved " + prettyBytes(bytesSaved) + "(" + ((bytesSaved / totalBytesConsidered) * 100).toFixed() + "%)";
                } else {
                    statusMessage = "JS is optimized";
                }
                logInfo(chalk.green("ᗘ ") + chalk.gray("Lib JS compressed to " + destinationFile) + " -- " + statusMessage);
                return resolve(result);
            });
    });
}

/**
 * Determine how to handle images: either optimize and copy or just copy. Returns a Promise.
 * @param sourcePath
 * @param destinationPath
 * @param imagesGlobSpec
 * @returns Promise
 */
function handleImages(sourcePath, destinationPath, imagesGlobSpec) {
    if (configuration.isOptimizingImages) {
        return optimizeImages(sourcePath, destinationPath, imagesGlobSpec);
    } else {
        return copyImages(sourcePath, destinationPath, imagesGlobSpec);
    }
}

/**
 * Display end of build statistics.
 */
function showStats() {
    logInfo(chalk.green("ᙘ ") + chalk.yellow("Build stats:"));
    var dateDiff = (compressionStats.endTime.getTime() - compressionStats.startTime.getTime()) / 1000;
    var bytesSaved = compressionStats.totalBytesConsidered - compressionStats.totalBytesCompressed;
    var bytesRatio = ((bytesSaved / compressionStats.totalBytesConsidered) * 100).toFixed();
    logInfo(chalk.green("ᙘ Completed build in " + dateDiff + "s: " + compressionStats.totalFiles + " files, originally " + prettyBytes(compressionStats.totalBytesConsidered) + ", now " + prettyBytes(compressionStats.totalBytesCompressed) + " saving " + prettyBytes(bytesSaved) + " (" + bytesRatio + "%)."));
}

/**
 * Run the build:
 *   - we can run in parallel css, js, html, and image optimizations
 *   - when those tasks are complete then run the copy files to distrib
 *   - when distrib is complete then run copy files to folder
 *   - after everything is done then show build statistics.
 */
function runBuild() {
    Promise.all([
        optimizeJS(configuration.sourceFolder + "/js", configuration.destinationFolder + "/js", configuration.packageName),
        optimizeJSLibs(configuration.sourceFolder, configuration.destinationFolder),
        handleImages(configuration.sourceFolder, configuration.destinationFolder, configuration.imagesFileSpec)
    ]).then(function (result) {
        logInfo(chalk.green("ᙘ All builds complete"));
        showStats(result);
    }).catch(function (error) {
        logError(error.toString() + " -- probably unhandled error.");
    });
}

getCommandLineArguments();
runBuild();
