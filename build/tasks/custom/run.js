module.exports = function( grunt ) {
	const LegacyNwBuilder = require( "nw-builder" );
	const platforms = require( "../common/platforms" );
	const { resolve: r } = require( "path" );

	const stripGlob = value => String( value ).replace( /[\\/]\*\*?$/, "" );

	function toArgv( value ) {
		if ( Array.isArray( value ) ) {
			return value;
		}

		return value ? [ value ] : [];
	}

	async function runModern( options, platformName, src ) {
		const { default: nwbuild } = await import( "nw-builder-modern" );
		const nwConf = grunt.config( "nwjs" );
		const targetOptions = nwConf[ platformName ].options;

		const appProcess = await nwbuild({
			mode: "run",
			version: targetOptions.version,
			flavor: options.flavor,
			cacheDir: options.cacheDir,
			platform: targetOptions.platform,
			arch: targetOptions.arch,
			srcDir: r( process.cwd(), stripGlob( src ) ),
			glob: false,
			argv: toArgv( options.argv )
		});

		if ( !appProcess ) {
			return;
		}

		return new Promise( ( resolve, reject ) => {
			appProcess.once( "error", reject );
			appProcess.once( "close", code => {
				if ( code === 0 || code === null ) {
					resolve();
				} else {
					reject( new Error( `NW.js exited with code ${code}` ) );
				}
			});
		});
	}

	function taskRun() {
		const done = this.async();
		const platformName = platforms.getPlatform();
		const options = this.options({
			platforms: [ platformName ]
		});

		if ( platformName === "osxarm64" ) {
			runModern( options, platformName, this.data.src )
				.then( done, grunt.fail.fatal );
			return;
		}

		options.files = r( process.cwd(), this.data.src );

		const nw = new LegacyNwBuilder( options );

		nw.on( "log", grunt.log.writeln.bind( grunt.log ) );
		nw.on( "stdout", grunt.log.writeln.bind( grunt.log ) );
		nw.on( "stderr", grunt.log.writeln.bind( grunt.log ) );

		nw.run().then( done, grunt.fail.fatal );
	}

	grunt.task.registerMultiTask(
		"run",
		"Run the previously built NW.js application",
		taskRun
	);
};
