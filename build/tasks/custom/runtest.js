module.exports = function( grunt ) {
	grunt.registerTask( "runtest", "Run the tests in NW.js", function() {
		const LegacyNwBuilder = require( "nw-builder" );
		const cdpConnect = require( "../common/cdp/connect" );
		const cdpQUnit = require( "../common/cdp/qunit" );
		const cdpCoverage = require( "../common/cdp/coverage" );
		const { resolve: r } = require( "path" );

		const platforms = require( "../common/platforms" );
		const platform = platforms.getPlatform();
		const isModern = platform === "osxarm64";

		const isCI = process.env[ "CI" ] === "true";
		const isCoverage = !!this.flags.coverage;

		const done = this.async();
		const options = this.options({
			host: "127.0.0.1",
			port: isCI ? 4444 : 8000,
			connectAttempts: isCI ? 10 : 5,
			connectDelay: isCI ? 2000 : 1000,
			startTimeout: 10000,
			testTimeout: 300000,
			coverageTimeout: 5000
		});

		const nwConf = grunt.config( "nwjs" );
		const { options: nwOptions, [ platform ]: { options: nwPlatformOptions } } = nwConf;

		const argv = [ `--remote-debugging-port=${options.port}` ];
		if ( isCI ) {
			argv.unshift( "--disable-gpu", "--no-sandbox" );
		}

		let nwjs;
		let appProcess;

		function kill() {
			if ( isModern ) {
				if ( appProcess && !appProcess.killed ) {
					appProcess.removeAllListeners( "close" );
					appProcess.kill();
					grunt.log.debug( "NW.js stopped" );
				}
				appProcess = undefined;
				process.removeListener( "exit", kill );
				return;
			}

			if ( nwjs && nwjs.isAppRunning() ) {
				const nwjsProcess = nwjs.getAppProcess();

				// workaround for the close event log message
				nwjsProcess.removeAllListeners( "close" );
				nwjs._nwProcess = undefined;

				// now kill the child process
				nwjsProcess.kill();

				grunt.log.debug( "NW.js stopped" );
				process.removeListener( "exit", kill );
			}
		}

		function fail( err ) {
			kill();
			if ( err ) {
				grunt.fail.fatal( String( err ) );
			} else {
				grunt.util.exit( 1 );
			}
		}

		function connect() {
			return cdpConnect( options, grunt.log.error )
				.then( async cdp => {
					grunt.log.debug( `Connected to ${options.host}:${options.port}` );

					// set up and start QUnit
					await cdpQUnit( grunt, options, cdp );
					if ( isCoverage ) {
						await cdpCoverage( grunt, options, cdp );
					}
				});
		}

		new Promise( ( resolve, reject ) => {
			process.on( "exit", kill );
			grunt.log.debug( "Starting NW.js..." );

			if ( isModern ) {
				import( "nw-builder-modern" )
					.then( ( { default: nwbuild } ) => nwbuild({
						mode: "run",
						version: nwPlatformOptions.version,
						flavor: "sdk",
						cacheDir: nwOptions.cacheDir,
						platform: nwPlatformOptions.platform,
						arch: nwPlatformOptions.arch,
						srcDir: r( process.cwd(), String( options.path ).replace( /[\\/]\*\*?$/, "" ) ),
						glob: false,
						argv
					}) )
					.then( nwjsProcess => {
						appProcess = nwjsProcess;
						if ( !appProcess ) {
							throw new Error( "NW.js did not start" );
						}

						grunt.log.debug( "NW.js started" );
						appProcess.once( "close", () => reject( "NW.js exited prematurely" ) );
						return connect();
					})
					.then( resolve, reject );
				return;
			}

			const nwjsOptions = Object.assign( {}, nwOptions, nwPlatformOptions, {
				flavor: "sdk",
				files: options.path,
				argv
			});
			nwjs = new LegacyNwBuilder( nwjsOptions );

			nwjs.on( "log", grunt.log.writeln.bind( grunt.log ) );
			nwjs.on( "stdout", grunt.log.writeln.bind( grunt.log ) );
			nwjs.on( "stderr", grunt.log.writeln.bind( grunt.log ) );

			// listen for the appstart event
			nwjs.on( "appstart", () => {
				grunt.log.debug( "NW.js started" );

				const nwjsProcess = nwjs.getAppProcess();
				nwjsProcess.on( "close", () => {
					reject( "NW.js exited prematurely" );
				});

				connect().then( resolve, reject );
			});

			// start the NW.js process (or download NW.js first)
			// reject if NW.js exited prematurely
			nwjs.run().then( reject, reject );
		})
			// make sure to terminate the NW.js process
			.then( noShutdown => {
				if ( noShutdown !== true ) {
					kill();
				}
			})
			.then( done, fail );
	});
};
