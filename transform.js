const _find = require('lodash.find')
const components = require('./components')
const j = require('jscodeshift')

/**
 * TODO: add tests
 */

module.exports = function(fileInfo, options) {
  const root = j(fileInfo.source)

  const TDSImports = root.find(j.ImportDeclaration, {
    source: {
      value: '@telusdigital/tds'
    }
  })

  TDSImports.insertAfter(path => {
    var { node } = path
    /** newCode example
     * [
     *   {
     *     default: {
     *       name: 'ExpandCollapse'
     *       local: 'ExpandCollapse'
     *     },
     *     children: [
     *       {
     *         name: 'Accordion'
     *         local: 'Accordion'
     *       }
     *     ]
     *   },
     *   {
     *     default: {
     *       name: 'Button',
     *       local: 'TDSButton'
     *     }
     *   }
     * ]
     */
    var newCode = [] // Code collection
    var newName = ''
    var newPackage = ''

    const addPackage = (name, local) => {
      // console.log('package is', name)
      
      const existingIndex = newCode.findIndex(codeSet => {
        if (!components[name].combineWith) {
          // Standalone package, no children
          return false
        }

        var findExisting = false
        
        // Check current `codeSet` collection for objects that pair
        // with the current `name` iteration
        components[name].combineWith.forEach(matcher => {
          if (_find(codeSet.children, {name: matcher}) || _find(codeSet.default, {name: matcher})) {
            findExisting = true
          }
        })
        
        // return index of matching object to merge into
        return findExisting
      })

      if (existingIndex === -1) {
        // New child or default module
        // Without related modules'

        if (components[name].isChild) {
          newCode.push({
            children: [{
              name, local
            }],
            default: {},
            package: components[name].package
          })
        } else {
          newCode.push({
            children: [],
            default: {
              name, local
            },
            package: components[name].isDefault ? components[name].package : components[name]
          })
        }
      } else if (existingIndex >= 0) {
        // New child or default module
        // With related modules

        if (components[name].isChild) {
          newCode[existingIndex].children.push(
            {
              name, local
            }
          )
        } else if (components[name].isDefault) {
          newCode[existingIndex].default = {
            name, local
          }
        }
      }
    }

    node.specifiers.map(specifier => {
      const name = specifier.imported.name
      const local = specifier.local.name

      addPackage(name, local)
    })

    const finalCode = newCode.map(el => {
      var defaultModule = ''
      var childModules = ''

      // console.log('el is', el)
      
      // Set defaultModule
      if (JSON.stringify(el.default) !== JSON.stringify({})) {
        defaultModule = el.default.name === el.default.local ? el.default.name : `${el.default.name} as ${el.default.local}`
      }

      // Set childModules
      childModules = el.children.length > 0 ? el.children.map(child => {
        if (child.name === child.local) {
          return child.name
        } else {
          return `${child.name} as ${child.local}`
        }
      }) : []

      if (childModules.length > 0) {
        let comma = defaultModule !== '' ? ', ' : ''
        childModules = `${comma}{ ${childModules.join(', ')} }`
      }
      
      return `import ${defaultModule}${childModules} from '@tds/${el.package}'`
    })

    // Append new TDS imports
    return finalCode
  })
  
  // Remove former TDS import
  TDSImports.remove()

  return root.toSource()
};
