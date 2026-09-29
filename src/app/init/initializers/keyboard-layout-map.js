/**
 * @typedef {Map<string, string>} KeyboardLayoutMap
 */
/**
 * @function navigator.keyboard.getLayoutMap
 * @returns Promise<KeyboardLayoutMap>
 */


export default {
	name: "keyboard-layout-map",

	/** @param {Ember.Application} application */
	initialize( application ) {
		// Don't block application readiness on the asynchronous Keyboard Map API.
		// Hotkey titles can use an empty fallback map during startup, and the same
		// Map instance gets populated in-place once Chromium resolves the layout.
		const layoutMap = new Map();
		application.register( "keyboardlayoutmap:main", layoutMap, { instantiate: false } );

		Promise.resolve()
			.then( () => navigator.keyboard.getLayoutMap() )
			.catch( () => new Map() )
			.then( /** @param {KeyboardLayoutMap} resolvedMap */ resolvedMap => {
				layoutMap.clear();
				for ( const [ code, key ] of resolvedMap ) {
					layoutMap.set( code, key );
				}
			});
	}
};
