/**
 * Internationalisation tools
 * @module ys/i18n
 * @requires base
 */

var

NS = 'ys',

DEFAULT_LOCALE = 'en_US',

/**
 * I18n object for an unique translation
 */
I18n = function(config)
{
    I18n.superclass.constructor.apply(this, arguments);
},
/**
 * Manager of all translation in the app
 */
I18nManager = function(config)
{
    I18nManager.superclass.constructor.apply(this, arguments);
};

/**
 * Whitelisting the DOMNodeRemovedFromDocument event to use it on
 * I18n's node destruction
 */
Y.mix(Y.Node.DOM_EVENTS, {
    DOMNodeRemovedFromDocument: true
});

/**
 * I18n object helps to get a live translation of text.
 * @class I18nManager.I18n
 * @namespace Y.ys
 * @extends Y.Base
 * @constructor
 * @param {Object} config Object with configuration property name/value
 * pairs. The object can be used to provide default values for the objects
 * published attributes.
 *
 * <p>
 * The config object can also contain the following non-attribute
 * properties, providing a convenient way to configure events listeners and
 * plugins for the instance, as part of the constructor call:
 * </p>
 *
 * <dl>
 *     <dt>params</dt>
 *     <dd>Object of name/value text to replace @@name@@ into
 * translation</dd>
 *        <dt></dt>
 * </dl>
 */
Y.extend(I18n, Y.Base, {

    /**
     * Initialize a i18n object
     * @method initializer
     * @protected
     */
    initializer: function(config)
    {
        /**
         * Add new attrs for each params in the params attr
         * and call insertTranslation method on one of them change
         */
        if (config.params)
        {
            Y.Object.each(
                config.params,
                function(v, k)
                {
                    this.addAttr(k, {broadcast: 1});
                    this.after(
                        k+'Change',
                        function()
                        {
                            this._insertTranslation();
                        },
                        this
                    );
                },
                this
            );

            this.setAttrs(config.params);
        }

        /**
         * After locale change, call the changeLanguage method to update the
         * node
         */
        this.after(
            'localeChange',
            function(e)
            {
                this.getLocalizedString();
            }
        );

        /**
         * Set translation in node asynchronously
         */
        this.after(
            'translationChange',
            function(e)
            {
                this._insertTranslation();
            }
        );
        
        this._checklife = Y.later(
            5000,
            this,
            function()
            {
                if (!Y.one('#'+this.get('id')))
                {
                    this.destroy();
                    delete this;
                }
            },
            null,
            true
        );
    },
    
    destructor: function()
    {
        this._checklife.cancel();
    },

    /**
     * Load the translations file, and get the localized string from the key
     * Call is asynchronized, so it will update `translation` attr when
     * it'll be load, and so, fire `translationChange` event.
     * @method getLocalizedString
     * @public
     */
    getLocalizedString: function()
    {
        var raw_key = this.get('key').split(/~/),
            module = raw_key ? raw_key[0] : null,
            key = raw_key ? raw_key[1] : null,
            locale = this.get('locale'),
            name = 'i18n/'+locale+'/'+module,
            self = this;

        if (!module)
        {
            throw new Error('module~key invalid');
        }

        /**
         * Load the translation file module
         */
        YUI().use(name, function(Y2) {

            try
            {
                Y[NS] = Y2.merge(
                    Y[NS],
                    Y2[NS]
                );
                /**
                 * Copy the module class in the main Y object
                 */
                var t = Y[NS].I18n[locale][module][key];

                /**
                 * Update `translation` attr
                 */
                self.set(
                    'translation',
                    t
                );
            }
            catch (e)
            {
                Y.log('Locale '+key+' is not available in locale "'+locale+'"');
            }
        });
    },

    /**
     * Get a localized string from key
     * key has the form : 'module~key'
     * @method localize
     * @param {boolean} tostring Set to true if you want a node as a string
     * to set as innerHTML of a parent node. Default is Y.Node object to
     * be append in a parent node. You can set a
     * callback function to do whatever you want with the translation when it's
     * loaded. The callback will be called everytime the translation change.
     * @return Y.Node|string
     * @public
     */
    localize: function(tostring)
    {
        var node, t;

        /**
         * Load the locale
         */
        this.getLocalizedString();

        t = this._insertTranslation();

        /**
         * Create the string node
         */
        node = '<span id="'+this.get('id')+'">'+
            t+
            '</span>';

        /**
         * Create a node from the string
         */
        if (tostring !== true)
        {
            node = Y.Node.create(node);
            node.i18n = this;
            this.set('node', node);
        }
        /**
         * A callback has been given. This callback will be called everytime the
         * translation change. The callback take the translation as first param.
         */
        if (typeof tostring === 'function')
        {
            tostring(t);
            this.after(
                'translationChange',
                function(e, fn)
                {
                    fn(this._insertTranslation());
                },
                this,
                tostring
            );
        }
        /**
         * If tostring is true, a string will returned instead of a Node
         * object. It's usefull for templates not already instancied.
         */

        return node;
    },


    /**
     * Get node from attr or from dom
     * @method getNode
     * @return Y.Node
     * @public
     */
    getNode: function()
    {
        var node = this.get('node');

        if (!node)
        {
            /**
             * No node set, try to get it in DOM from the ID given to the
             * string node
             */
            node = Y.one('#'+this.get('id'));
            this.set('node', node);
        }

        return node;
    },
    /**
     * Replace translation string with uptodate params in the node span
     * container
     * @method _insertTranslation
     * @return string
     * @protected
     */
    _insertTranslation: function()
    {
        var node = this.getNode()
            t = this.get('translation');

        t = t && t.replace(
            /@@(.[^(@@)]*?)@@/gi,
            Y.bind(
                function(a, b)
                {
                    var v = this.get(b);
                    return v ? v : '';
                },
                this
            ),
            t
        );

        if (node)
        {
            node.set(
                'innerHTML',
                t
            );

            node.fire('i18n:change', {translation: t});
        }

        return t;
    },
    /**
     * Destruct the node and purge all its events listeners
     * @method destructor
     * @protected
     */
    destructor: function()
    {
        var node = this.get('node');
        if (node)
        {
            Y.Event.purgeElement(node, true);
            node.remove();
        }
    }
},
{
    NAME: 'I18n',
    ATTRS: {
        /**
         * A random GUID generated at the instanciation
         * @attribute id
         * @private
         */
        id: {
            valueFn: function()
            {
                return Y.guid();
            }
        },
        /**
         * Language code for the translation
         * @attribute locale
         * @public
         */
        locale: {
            value: null,
            /**
             * Fired when locale code has changed
             * @event localeChange
             */
            broadcast: 1
        },
        /**
         * Translation key
         * @attribute key
         * @public
         */
        key: {
            value: null
        },
        /**
         * Container node
         * @attribute node
         * @private
         */
        node: {
            setter: function(n)
            {
                if (n)
                {
                    n.on(
                        'DOMNodeRemovedFromDocument',
                        function()
                        {
                            this.set('node', null);
                            this.destroy();
                        },
                        this
                    )
                }
                return n;
            }
        },
        /**
         * Translation text
         * @attribute translation
         * @public
         */
        translation: {
            value: '&nbsp;', /* fix a bug with chrome when sometime an empty
                              * span filled later doesn't change its content
                              * size
                              */
            /**
             * Fired when translated text has changed
             * @event translationChange
             */
            broadcast: 1
        }
    }
});

/**
 * I18nManager helps to create new translations and globally set locale code
 * @class I18nManager
 * @namespace Y.ys
 * @extends Y.Base
 * @constructor
 */
Y.extend(I18nManager, Y.Base, {
    /**
     * Initialize the manager and set the default locale code : from the
     * browser or from the app_config
     * @method initializer
     * @protected
     */
    initializer: function()
    {
        /**
         * Set initial locale from browser environement
         */
        this.set(
            'locale',
            navigator.language || navigator.userLanguage || DEFAULT_LOCALE
        );

        /**
         * Bind locale change event to set all the instancied I18n locale
         */
        this.after(
            'localeChange',
            function()
            {
                var keys = this.get('keys'),
                    locale = this.get('locale');

                Y.Object.each(
                    keys,
                    function(I18n)
                    {
                        if (I18n)
                        {
                            I18n.set('locale', locale);
                        }
                    }
                );
            }
        );
    },

    /**
     * Get a localized string from key
     * key has the form : 'module~key'
     * @method localize
     * @param {string} key The key of the locale to translate. Must have the
     * form `file~key`. `key` can have /[a-zA-Z0-9\.\-_]/ characters.
     * @param {object} params Parameters to give to the translation. The
     * translation must have some @@name@@ keyword to place the parameter.
     * @param {boolean|Function} tostring True if you want a string to insert in
     * a innerHTML. Default if you want a Y.Node to append in DOM. You can set a
     * callback function to do whatever you want with the translation when it's
     * loaded. The callback will be called everytime the translation change.
     * @example <pre>
     * __('file~key', null, Y.bind(
     *     function(text)
     *     {
     *         this.one('input').setAttribute('placeholder', text);
     *     },
     *     this
     * ));
     * // The placeholder attribute will be updated when the locale will be
     * // loaded and everytime the use change the global locale.
     * </pre>
     * @return string|Y.Node
     * @public
     */
    localize: function(key, params, tostring)
    {
        var keys = this.get('keys'),
            el = this.createKey(key, params);

        params || (params = {});

        return el.localize(tostring);
    },

    /**
     * Create a new key
     * @method createKey
     * @param {string} key The key of the locale to translate. Must have the
     * form `file~key`. `key` can have /[a-zA-Z0-9\.\-_]/ characters.
     * @param {object} params Parameters to give to the translation. The
     * translation must have some @@name@@ keyword to place the parameter.
     * @return Y.ys.I18n
     * @public
     */
    createKey: function(key, params)
    {
        var i = new I18n({
                key: key,
                locale: this.get('locale'),
                params: params
            }),
            keys = this.get('keys');

        keys[i.get('id')] = i;

        this.set('keys', keys);

        return i;
    }
},
{
    NAME: 'I18nManager',
    ATTRS: {
        /**
         * Global language configuration
         * @attribute locale
         * @public
         */
        locale: {
            value: DEFAULT_LOCALE,
            setter: function(locale)
            {
                var found = false,
                    dft = DEFAULT_LOCALE;

                /**
                 * Look into config if asked locale is available
                 */
                if (Y.config.locales)
                {
                    Y.Array.some(
                        Y.config.locales,
                        function(l)
                        {
                            if (l.locale === locale)
                            {
                                locale = l.locale;
                                return (found = true);
                            }
                            if (l.sameas)
                            {
                                Y.Array.some(
                                    l.sameas,
                                    function(s)
                                    {
                                        if (s === locale)
                                        {
                                            locale = l.locale;
                                            return (found = true);
                                        }
                                    }
                                );
                            }
                            if (true === l['default'])
                            {
                                dft = l.locale
                            }
                            return found;
                        }
                    );
                }

                if (!found)
                {
                    locale = dft;
                }

                return locale;
            },
            /**
             * Fired when the locale has been changed
             * @event localeChange
             */
            broadcast: 1
        },
        /**
         * Collection of I18n objects
         * @attribute keys
         * @protected
         */
        keys: {
            valueFn: Object
        }
    }
});

/**
 * Instanciate new I18nManager in the ys namespace
 */
Y.namespace(NS).I18nManager = new I18nManager();
Y.namespace(NS).I18nManager.I18n = I18n;
/**
 * Create a usefull global function : __()
 * @method window.__
 * @param {string} key Translation key
 * @param {object} param Object of params to give to the locale
 * @param {boolean} tostring Do you want a Node or a string ?
 */
window.__ = function(key, params, tostring)
{
    return Y.ys.I18nManager.localize(key, params, tostring);
};
