
module.exports = bundle

var npm = require("../npm")
  , path = require("path")
  , log = require("./utils/log")
  , cache = require("./cache")
  , readJson = require("./utils/read-json")
  , mkdir = require("./utils/mkdir-p")
  , fs = require("./utils/graceful-fs")
  , conf = require("./utils/ini").configList
  , notAllowed = [ "adduser", "build", "bundle", "config", "init", "link"
                 ,"owner", "publish", "restart", "start", "stop", "tag"
                 , "unpublish", "update-dependents", "view" ]

bundle.usage = "npm bundle\n"
             + "npm bundle install <pkg> [<pkg>...]\n"
             + "npm bundle rm <pkgname> [<pkgname>...]\n"
             + "(run in package dir)"

bundle.completion = function(args, index, cb) {
  var getCompletions = require("./utils/completion/get-completions")
    , subcmdList = npm.fullList.filter(function(c) {
      return notAllowed.indexOf(c) === -1
    })
    , subcmd = args[0] || ""

  if (subcmdList.indexOf(subcmd) !== -1) {
    var subargs = args.slice(1)
    npm.commands[npm.deref(subcmd)].completion(subargs, index, cb)
  } else if (index < 3) cb(null, getCompletions(subcmd, subcmdList))
}

function bundle (args, cb_) {
  var location = path.join(process.cwd(), "./node_modules")
    , pkg = process.cwd()
    , cmd = args.shift()
  function cb (er, data) {
    conf.shift()
    cb_(er, data)
  }
  mkdir(location, function (er) {
    var c = { root : location
            , binroot : null
            , manroot : null
            , "must-install" : false
            }
    conf.unshift(c)

    if (cmd && npm.commands[cmd]) {
      cmd = npm.commands[cmd]
      for (var i = 0, l = notAllowed.length; i < l; i ++) {
        if (cmd === npm.commands[i]) {
          return cb(new Error(i + " command not allowed in bundle"))
        }
      }
      if (cmd === npm.commands.ls) {
        c.registry = null
      }
    }

    if (er) return cb(new Error(bundle.usage))
    mkdir(npm.dir, function(er) {
      if (er) return log.er(cb, "Error creating "+npm.dir+" for bundling")(er)
      if (typeof cmd === "function") {
        return cmd(args, cb)
      }

      // no command given, just install the local deps.
      // just read the package.json from the directory to
      // avoid adding the whole package to the cache
      readJson(path.join(pkg, "package.json"), function (er, data) {
        if (er) return log.er(cb, "Error reading "+pkg+"/package.json")(er)
        install(data, location, cb)
      })
    })
  })
}

function install (data, location, cb) {
  if (typeof data.dependencies === 'undefined') {
    return cb(new Error("Package has no dependencies"))
  }
  var depNames = Object.keys(data.dependencies)
    , deps = depNames.map(function (d) {
        var v = data.dependencies[d]
        if (v === "*") v = ""
        return v ? d + "@" + v : d
      })
  log.verbose(deps, "bundle deps")
  npm.commands.install(deps, log.er(cb, "Some dependencies failed to bundle\n"
                                      + "Bundle them separately with\n"
                                      + "  npm bundle install <pkg>"))
}
