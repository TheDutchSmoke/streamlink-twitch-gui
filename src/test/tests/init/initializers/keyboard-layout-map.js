import { module, test } from "qunit";
import {
	getApplication,
	setupContext,
	teardownContext,
	setupApplicationContext,
	teardownApplicationContext
} from "@ember/test-helpers";
import { buildFakeApplication } from "test-utils";
import sinon from "sinon";

import KeyboardLayoutMapInitializer from "init/initializers/keyboard-layout-map";


module( "init/initializers/keyboard-layout-map", function( hooks ) {
	buildFakeApplication( hooks, { each: true }, {} );

	hooks.before(function() {
		this.getLayoutMapStub = sinon.stub( navigator.keyboard, "getLayoutMap" );
	});

	hooks.after(function() {
		this.getLayoutMapStub.restore();
	});

	hooks.beforeEach(function() {
		const application = getApplication();
		application.initializer( KeyboardLayoutMapInitializer );
	});

	hooks.afterEach(async function() {
		await teardownApplicationContext( this );
		await teardownContext( this );
	});


	test( "Initializer - success", async function( assert ) {
		this.getLayoutMapStub.resolves( new Map([[ "KeyA", "a" ]]) );

		await setupContext( this );
		await setupApplicationContext( this );

		const keyboardLayoutMap = this.owner.lookup( "keyboardlayoutmap:main" );
		await Promise.resolve();
		await Promise.resolve();

		assert.ok( keyboardLayoutMap instanceof Map, "Registers the keyboard layout map" );
		assert.strictEqual(
			keyboardLayoutMap.get( "KeyA" ),
			"a",
			"Populates the map asynchronously"
		);
	});

	test( "Initializer - failure", async function( assert ) {
		this.getLayoutMapStub.rejects();

		await setupContext( this );
		await setupApplicationContext( this );

		const keyboardLayoutMap = this.owner.lookup( "keyboardlayoutmap:main" );
		assert.ok( keyboardLayoutMap instanceof Map, "Registers the empty fallback map" );
	});
});
