
// Add new CSS styles here
const supportedTextStyles = { 
    color: { cssKey: "color", default: "#000" },
    fontSize: { cssKey: "font-size", default: "normal" }, 
    textDecoration: { cssKey: "text-decoration", default: "none" }
}

// The textStyle ProseMirror MarkSpec
const textStyle = {
    attrs: textStyleMarkAttributes(),
    parseDOM: [{tag: "span", getAttrs(dom) {
      return cssToMarkAttr( dom.getAttribute("style") )
    }}], 
    toDOM(mark) {
      return ["span", { style: markAttrsToCSS( mark.attrs ) }, 0] 
    }
}

function textStyleMarkAttributes() {
    let markAttrs = {}
    for( let styleKey of Object.keys(supportedTextStyles) ) {
        const defaultValue = supportedTextStyles[styleKey].default
        markAttrs[styleKey] = { default: defaultValue }
    }
    return markAttrs
}

const cssToMarkAttr = function cssToMarkAttr( styleAttribute ) {
    if( !styleAttribute ) return null

    const cssExpressions = styleAttribute.split(';')
    let foundStyles = {}
    for( const cssExpression of cssExpressions ) {
        for( let styleKey of Object.keys(supportedTextStyles) ) {
            const cssKey = supportedTextStyles[styleKey].cssKey
            const styleRegEx = new RegExp(`^\\s*${cssKey}:\\s*([^;]*)`)
            let matches = cssExpression.match(styleRegEx)
            let value = matches && matches.length > 1 ? matches[1] : null;  
            if( value ) {
                foundStyles[styleKey] = value
            }
        }    
    }

    return foundStyles
}

function markAttrsToCSS( attrs ) {
    let styleStr = ""
    for( let styleKey of Object.keys(supportedTextStyles) ) {
        const cssKey = supportedTextStyles[styleKey].cssKey
        const value = attrs[styleKey] 
        if( value ) {
            styleStr = styleStr.concat(`${cssKey}:${value};`)
        }
    }
    return styleStr
}
  
module.exports.textStyle = textStyle
module.exports.cssToMarkAttr = cssToMarkAttr
