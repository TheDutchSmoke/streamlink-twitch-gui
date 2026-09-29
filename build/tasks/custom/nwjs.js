module.exports = function( grunt ) {
	const LegacyNwBuilder = require( "nw-builder" );
	const { rm } = require( "fs/promises" );
	const { resolve: r } = require( "path" );

	async function buildModern( options ) {
		const { default: nwbuild } = await import( "nw-builder-modern" );
		const {
			version,
			flavor,
			cacheDir,
			platform,
			arch,
			srcDir,
			outDir,
			glob,
			zip,
			app,
			excludeAppPaths = []
		} = options;

		await nwbuild({
			mode: "build",
			version,
			flavor,
			cacheDir,
			platform,
			arch,
			srcDir,
			outDir,
			glob,
			zip,
			app
		});

		const appRoot = r( outDir, `${app.name}.app`, "Contents", "Resources", "app.nw" );
		await Promise.all(
			excludeAppPaths.map( relativePath =>
				rm( r( appRoot, relativePath ), { recursive: true, force: true } )
			)
		);
	}

	function taskNwjs() {
		const done = this.async();
		const options = this.options();

		if ( this.flags.debug ) {
			options.flavor = "sdk";
		}

		if ( options.builder === "modern" ) {
			buildModern( options )
				.then( () => {
					grunt.log.ok( "NW.js application created." );
					done();
				}, grunt.fail.fatal );
			return;
		}

		const nw = new LegacyNwBuilder( options );

		nw.on( "log", grunt.log.debug );
		nw.on( "stdout", grunt.log.debug );
		nw.on( "stderr", grunt.log.debug );

		nw.build()
			.then( () => {
				grunt.log.ok( "NW.js application created." );
				done();
			}, grunt.fail.fatal );
	}

	grunt.registerMultiTask(
		"nwjs",
		"Create an NW.js build of the application",
		taskNwjs
	);
};
