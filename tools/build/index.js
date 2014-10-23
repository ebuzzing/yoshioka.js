/**
 * Build engine
 * @module tools/build
 */
(function() {

var

APP_PATH = __dirname.replace(/yoshioka\.js.*$/, ''),
BUILD_DIR = 'build/',

fs = require('fs'),
exec = require('child_process').exec,
url = require('url'),
util = require('util'),
rimraf = require('../../lib/rimraf'),

compiler = require('../compiler'),
Maker = require('../make').Maker,
getconfig = require('../make/getconfig');

function Builder(config) {
  config = config || {}
  Maker.call(this, config)

  this.debug = config.debug
  this._configtype = config.type
  this._buildname = config.buildname || new Date().getTime()
  this._buildpath = config.buildpath || BUILD_DIR + this._buildname + '/'

  this._appConfig = getconfig.getConfig({
      dev:   this._configtype === 'dev',
      tests: this._configtype === 'tests'
  })

  // Add all directories in root
  this.dirs = ['config']
  if (this._appConfig && this._appConfig.yoshioka && this._appConfig.yoshioka.bundles) {
    this.dirs = this.dirs.concat(this._appConfig.yoshioka.bundles.map(function(b) {
      return b.path
    }))
  }

  // Add all html files in root
  this.files = fs.readdirSync(APP_PATH).filter(function(f) {
    return f.match(/\.html$/)
  })

  // Read yoshioka's config
  this._coreConfig = JSON.parse(fs.readFileSync(APP_PATH+'yoshioka.js/core/core_config.js'))
}

util.inherits(Builder, Maker)

Builder.prototype._ignore = [
  'config/config.js',
  'config/app_config.js',
  'config/dev_config.js',
  'config/tests_config.js',
  'config/tconfig.js',
  'yoshioka.js/core/core_config.js'
]

Builder.prototype.build = function()
{
  // Clean all previous builds
  fs.readdirSync(APP_PATH+BUILD_DIR).forEach(function(f) {
    var path = APP_PATH+BUILD_DIR+f;
    if (this.files.indexOf(f) > -1 || f.match(/^[0-9]+$/)) {
      rimraf.sync(path);
    }
  }.bind(this));

  // Create build subdir
  if (!fs.existsSync(APP_PATH+this._buildpath)) {
    fs.mkdirSync(APP_PATH+this._buildpath, 0755);
  }

  this.fetch()

  this.on('parseEnd', function() {
    this._makeConfig()
    this._compileLocales();

    var src = APP_PATH+'yoshioka.js/build'
    var out = APP_PATH+this._buildpath+'yoshioka.js'

    fs.mkdirSync(out);
    fs.mkdirSync(out + '/build');

    fs.writeFileSync(out + '/build/yoshioka.js', fs.readFileSync(src + '/yoshioka.js'))
    fs.writeFileSync(out + '/build/init.js', fs.readFileSync(src + '/init.js'))
  });
};

Builder.prototype._parseJSFile = function(path) {
  var ignore = this._ignore.some(function(file) {
    return path.match(file)
  })

  if (ignore) {
    this._parseComplete()
    return
  }

  var compilo
  var basepath = this._getDestinationPath(path).replace(/\/\/+$/, '/');
  var that = this

  this._mkdir(path, basepath + '/');

  if (path.match(/routes.js$/)) {
    compilo = new compiler.RoutesCompiler()
    compilo.parse(function(content) {
      fs.writeFileSync(basepath + path, content)
      that._parseComplete()
    })
  } else {
    compilo = new compiler.TemplateCompiler({
      file: path,
      basepath: (this._appConfig.basepath || '') + '/' + this._buildname
    })

    compilo.parse(function(content) {
      var c = new compiler.ModuleCompiler({
        filecontent: content,
        debug: this.debug
      })
      c.parse(function(content) {
        fs.writeFileSync(basepath + path, content)
        that._parseComplete()
      })
    })
  }
}

Builder.prototype._parseCSSFile = function(path) {
  var basepath = this._getDestinationPath(path)
  var that = this

  this._mkdir(path, basepath + '/')

  var compilo = new compiler.CSSCompiler({file: path})
  compilo.parse(function(content) {
    fs.writeFileSync(basepath + path, content)
    that._parseComplete()
  })
}

Builder.prototype._parseStaticFile = function(path) {
  if (path.match(/test\.js$/) || path.match(/tpl\.html/)) {
    this._parseComplete()
    return
  }

  var basepath = this._getDestinationPath(path)

  this._mkdir(path, basepath+'/')
  fs.writeFileSync(basepath + path, fs.readFileSync(APP_PATH + path))
  this._parseComplete()
}

Builder.prototype._parseHTMLFile = function(path, writepath) {
  var basepath = this._getDestinationPath(path)
  var that = this

  this._mkdir(path, basepath + '/')

  var compilo = new compiler.HTMLCompiler({
    file: path,
    basepath: (this._appConfig.basepath || '')+'/'+this._buildname,
    type: 'app'
  })

  compilo.parse(function(content) {
    path = writepath || path

    if (path.split(/\//).length === 1) {
      path = '../' + path
    }

    fs.writeFile(basepath + path, content)
    that._parseComplete()
  })
}

Builder.prototype._makeConfig = function() {
  var that = this
  var Maker = require('../make/').Maker
  var maker = new Maker({
    dirs: ['locales', 'plugins', 'views', 'config'],
    apppath: this._buildpath,
    basepath: (this._appConfig.basepath || '')+'/'+this._buildname+'/',
    buildname: this._buildname,
    buildpath: this._buildpath,
    dev: (this._configtype === 'dev'),
    tests: (this._configtype === 'tests')
  });

  maker.on('parseEnd', function() {
    maker.writeConfig({path: APP_PATH + maker._buildpath})
  })

  maker.on('writeEnd', function() {
    that.emit('configEnd')
  })

  console.log('Building config…')
  maker.fetch()
};
Builder.prototype.insertCopyright = function(path)
{
    var copyright = "/*\n{name} {version}\n{text}\n*/\n",
        data,
        filecontent = fs.readFileSync(APP_PATH+this._buildpath+path).toString(),
        basepath = this._getDestinationPath(path);

    if (path.match(/yoshioka\.js/))
    {
        data = this._coreConfig.copyright;
    }
    else
    {
        data = this._appConfig.copyright;
    }

    if (data)
    {
        filecontent = copyright
            .replace(/\{name\}/, data.name)
            .replace(/\{version\}/, data.version)
            .replace(/\{text\}/, data.text)
            + filecontent;
    }
    fs.writeFileSync(
        basepath+path,
        filecontent
    );
};

Builder.prototype._compileLocales = function()
{
    var lpath = APP_PATH+this._buildpath+'locales/',
        c;

    try
    {
        fs.mkdirSync(
            lpath
        );
    }
    catch(e){}

    this._appConfig.locales.forEach(
        function(l)
        {
            c = new compiler.I18nCompiler({
                locale: l.locale
            });
            c.parse(
                function(locale, content)
                {
                    fs.writeFileSync(
                        lpath+locale+'.js',
                        content
                    );
                }.bind(this, l.locale)
            );
        }.bind(this)
    );
};

Builder.prototype._getDestinationPath = function(path)
{
    var basepath = APP_PATH+this._buildpath;

    /**
     * If no bundle setting, just create the askde basepath
     */
    if (!path ||
        !this._appConfig ||
        !this._appConfig.yoshioka ||
        !this._appConfig.yoshioka.bundles)
    {
        return basepath;
    }

    var destination,
        pathparts = path.split(/\//),
        destinationparts;

    /**
     * Search into bundles setting if a `destination` basepath has been set
     */
    this._appConfig.yoshioka.bundles.forEach(
        function(b)
        {
            if (!b.destination) return;

            destinationparts = b.path.split(/\//);

            if (pathparts.slice(0, destinationparts.length).join('/') ===
                b.path)
            {
                basepath = APP_PATH+BUILD_DIR+b.destination;
            }
        }.bind(this)
    );

    return basepath;
}

exports.Builder = Builder;

})();
