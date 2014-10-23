// Requirement
var fs = require('fs'),
    YUI = require('yui').YUI,
    vm = require('vm'),
    path = require('path'),

    BASEPATH = __dirname+'/../../..',
    YUIALL = 'yui-all.js',

    readAppConfig = function(buildname)
    {
        var configfile = path.resolve(BASEPATH+'/build/'+buildname+'/config/config.js')
        var config = fs.readFileSync(configfile).toString();
        vm.runInThisContext(config);
    },
    loadYUI = function(require)
    {
        var Y = YUI(),
            loader = new Y.Loader({require:require}),
            requires = loader.resolve(true),
            paths = [];

        requires['jsMods'].forEach(
            function(js)
            {
                var root = js.path.split(/\//)[0];
                if (root === 'locales' ||
                    root === 'plugins' ||
                    root === 'views') return;

                paths.push(js.path);
            }
        );

        return paths;
    },
    insertScriptTag = function(buildname)
    {
        var htmls = [];

        fs.readdirSync(BASEPATH+'/build/').forEach(
            function(f)
            {
                if (f.match(/\.html$/))
                {
                    htmls.push(f);
                }
            }
        );

        htmls.forEach(
            function(f)
            {
                var filepath = BASEPATH+'/build/'+f,
                    content = fs.readFileSync(filepath).toString(),
                    // Get basepath
                    basepath = content.match(/src="(.*?)\/config\/config.js/);

                basepath = basepath && basepath[1];

                fs.writeFileSync(
                    filepath,
                    content.replace(
                        /(\/yui\/yui-min.js"><\/script>)/i,
                        '$1\n<script src="'+basepath+'/'+YUIALL+'"></script>'
                    )
                );
            }
        );
    };

exports.buildyui = function(config)
{
    // Let's go !!
    var buildname = config && config.buildname,
        appmodules = [],
        paths,
        allyui = '';

    readAppConfig(buildname)

    for (var m in YUI_config.groups[YUI_config.ys_app].modules)
    {
        appmodules.push(m);
    }

    paths = loadYUI(appmodules);

    // Read and concat all requires files
    paths.forEach(
        function(p)
        {
            var path = BASEPATH+'/yui3/build/'+p,
                file;

            try
            {
                file = fs.readFileSync(path).toString();
            }
            catch (e)
            {
                return;
            }

            allyui+=file;
        }
    );

    // Write file
    fs.writeFileSync(
        BASEPATH+'/build/'+buildname+'/'+YUIALL,
        allyui
    );

    // Alter html seeds
    insertScriptTag(buildname);
}
