const platforms = require( "../../common/platforms" );


class NwjsPlugin {
	constructor( nwConf = {}, nwOptionsOverride = {}, options = {} ) {
		const platform = platforms.getPlatform();
		const { options: nwOptions, [ platform ]: { options: nwPlatformOptions } } = nwConf;

		this.isModern = nwPlatformOptions.builder === "modern";
		this.nwOptions = Object.assign( {}, nwOptions, nwPlatformOptions, nwOptionsOverride );
		this.options = Object.assign({
			rerunOnExit: true,
			log: true,
			logStdOut: true,
			logStdErr: true
		}, options );
		this.launched = false;
	}

	apply( compiler ) {
		compiler.hooks.done.tap( "NwjsPlugin", () => {
			if ( !this.launched ) {
				this._run();
				this.launched = true;
			}
		});
	}

	_run() {
		if ( this.isModern ) {
			this._runModern();
			return;
		}

		const NwBuilder = require( "nw-builder" );
		const { nwOptions, options } = this;

		function log( msg ) {
			/* eslint-disable no-console */
			console.log( String( msg ).trim() );
		}

		function launch() {
			const nw = new NwBuilder( nwOptions );

			if ( options.log ) {
				nw.on( "log", log );
			}
			if ( options.log && options.logStdOut ) {
				nw.on( "stdout", log );
			}
			if ( options.log && options.logStdErr ) {
				nw.on( "stderr", log );
			}

			nw.run().then(function() {
				if ( options.rerunOnExit ) {
					setTimeout( launch, 1000 );
				}
			});
		}

		launch();
	}

	_runModern() {
		const { nwOptions, options } = this;
		const srcDir = String( nwOptions.files || nwOptions.srcDir ).replace( /[\\/]\*\*?$/, "" );
		let argv = [];
		if ( Array.isArray( nwOptions.argv ) ) {
			argv = nwOptions.argv;
		} else if ( nwOptions.argv ) {
			argv = [ nwOptions.argv ];
		}

		function log( msg ) {
			/* eslint-disable no-console */
			console.log( String( msg ).trim() );
		}

		async function launch() {
			try {
				const { default: nwbuild } = await import( "nw-builder-modern" );
				const appProcess = await nwbuild({
					mode: "run",
					version: nwOptions.version,
					flavor: nwOptions.flavor,
					cacheDir: nwOptions.cacheDir,
					platform: nwOptions.platform,
					arch: nwOptions.arch,
					srcDir,
					glob: false,
					argv,
					logLevel: options.log ? "info" : "error"
				});

				if ( !appProcess ) {
					throw new Error( "NW.js did not start" );
				}

				appProcess.once( "error", log );
				appProcess.once( "close", () => {
					if ( options.rerunOnExit ) {
						setTimeout( launch, 1000 );
					}
				});
			} catch ( err ) {
				log( err );
				if ( options.rerunOnExit ) {
					setTimeout( launch, 1000 );
				}
			}
		}

		launch();
	}
}


module.exports = NwjsPlugin;
