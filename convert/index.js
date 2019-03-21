const winston = require('winston')
const rdf = require('rdf')
const fs = require('fs')
const { DOMParser } = require('prosemirror-model')
const dmProseMirror = require('./dm-prose-mirror')
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const fabric = require('fabric').fabric
const MongoClient = require('mongodb').MongoClient

const mongoDatabaseURL = "mongodb://localhost:27017/"
const mongoDatabaseName = "dm2_convert"
const logFile = 'log/ttl-test.log'

// Global resources
var logger, mongoDB, mongoClient

// Predicates
const nodeType = convertURI("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
const w3Label = convertURI("http://www.w3.org/2000/01/rdf-schema#label")
const creator = convertURI("http://purl.org/dc/elements/1.1/creator")
const aggregates = convertURI("http://www.openarchives.org/ore/terms/aggregates")

const userNode = convertURI("http://xmlns.com/foaf/0.1/Agent")
const userName = convertURI("http://xmlns.com/foaf/0.1/name")
const userEmail = convertURI("http://xmlns.com/foaf/0.1/mbox")

const projectNode = convertURI("http://dm.drew.edu/ns/Project")
const projectName = w3Label
const projectUserURI = creator
const projectDescription = convertURI("http://purl.org/dc/terms/description")
const projectDocumentList = aggregates

const textDocumentNode = convertURI("http://purl.org/dc/dcmitype/Text")
const textDocumentName = w3Label
const textDocumentContent = convertURI("http://www.w3.org/2011/content#chars")

const imageDocumentNode = convertURI("http://www.shared-canvas.org/ns/Canvas")
const imageDocumentName = w3Label
const imageWidth = convertURI("http://www.w3.org/2003/12/exif/ns#width")
const imageHeight = convertURI("http://www.w3.org/2003/12/exif/ns#height")

const imageNode = convertURI("http://purl.org/dc/dcmitype/Image")

const annotationNode = convertURI("http://www.w3.org/ns/oa#Annotation")
const annotationHasBody = convertURI("http://www.w3.org/ns/oa#hasBody")
const annotationHasTarget = convertURI("http://www.w3.org/ns/oa#hasTarget")

const specificResource = convertURI("http://www.w3.org/ns/oa#SpecificResource")
const resourceSource = convertURI("http://www.w3.org/ns/oa#hasSource")
const resourceSelector = convertURI("http://www.w3.org/ns/oa#hasSelector")

const svgSelector = convertURI("http://www.w3.org/ns/oa#SvgSelector")
const svgContent = convertURI("http://www.w3.org/2011/content#chars")

const textQuoteSelector = convertURI("http://www.w3.org/ns/oa#TextQuoteSelector")
const textQuoteExcerpt = convertURI("http://www.w3.org/ns/oa#exact")

const yellow500 = "#ffeb3b"

// node type can only be one of these values
const typeVocab = [ 
    userNode, 
    projectNode, 
    textDocumentNode, 
    imageDocumentNode, 
    imageNode, 
    annotationNode,
    svgSelector,
    textQuoteSelector,
    specificResource
]

function loadTTL(ttlFile) {
    const ttlRaw = fs.readFileSync( ttlFile, "utf8");
    const ttlData = rdf.TurtleParser.parse(ttlRaw);
    return ttlData.graph.toArray()
}

// mongo doesn't like keys with '.' in them.
function convertURI( uri ) {
    return uri.replace(/\./g,'_')
}

function parseUser( node ) {
    // chop mailto:nick@performantsoftware.com
    const email = node[userEmail] ? node[userEmail].replace( /^mailto:/, '' ) : `${node.uri.replace(':','_')}@digitalmappa.org`
    const obj = {
        uri: node.uri,
        name: node[userName],
        email
    }
    return obj
}

function parseProject( node ) {
    const obj = {
        uri: node.uri,
        name: node[projectName],
        userURI: node[projectUserURI],
        description: node[projectDescription],
        documents: node[projectDocumentList]   // Project table of contents (doesn't include annotations)
    }
    return obj
}

function parseTextDocument( dmSchema, node ) {
    const dm1Content = node[textDocumentContent] 
    const htmlDOM = new JSDOM( dm1Content );
    const htmlDocument = htmlDOM.window.document

    const spans = htmlDocument.getElementsByClassName('atb-editor-textannotation')
    const selectorURIs = []
    const replacements = []

    // port the text annotation spans to DM2 
    for (let i = 0; i < spans.length; i++) {
        let dm2Span = htmlDocument.createElement('span')
        let span = spans[i];
        const selectorURI = span.getAttribute('about');
        dm2Span.setAttribute('class','dm-highlight')
        dm2Span.setAttribute('style','background: #ffeb3b')
        dm2Span.setAttribute('data-highlight-uid', selectorURI )
        dm2Span.innerHTML = span.innerHTML
        replacements.push([dm2Span,span])
    }

    // do this as a seperate step for the DOM's sake
    replacements.forEach( (replacement) => {
        let [ dm2Span, span ] = replacement
        span.parentNode.replaceChild(dm2Span, span);
    })

    // var debugstr = htmlDocument.body.parentElement.innerHTML
    const documentNode = DOMParser.fromSchema(dmSchema).parse(htmlDocument.body.parentElement)
    const searchText = documentNode.textBetween(0,documentNode.textContent.length, ' ');
    const content = JSON.stringify( {type: 'doc', content: documentNode.content} )

    const obj = {
        uri: node.uri,
        name: node[textDocumentName],
        documentKind: 'text',
        content,
        searchText
    }
    return obj
}

function parseImageDocument( node ) {
    const obj = {
        uri: node.uri,
        name: node[imageDocumentName],
        documentKind: 'canvas',
        content: '',
        width: node[imageWidth],
        height: node[imageHeight],
        images: []
    }
    return obj
}

function parseImage( node ) {
    // Example: <image:40615860_10217291030455677_4752239145311535104_n.jpg>
    const imageFilename = node.uri.replace( /^image:/, '' )

    const obj = {
        uri: node.uri,
        imageFilename
    }
    return obj
}

function parseAnnotation( node ) {
    const obj = {
        uri: node.uri,
        body: node[annotationHasBody],
        target: node[annotationHasTarget]
    }
    return obj
}

async function parseSVGSelector( node ) {
    let obj = {
        uri: node.uri,
        excerpt: 'Highlight',
        color: yellow500
    }
    // convert SVG object to FabricJS JSON
    const svg = `<svg>${node[svgContent]}</svg>`

    let shape = await new Promise(resolve => {
        fabric.loadSVGFromString(svg, (fabObj) => { 
            let shape = fabObj[0].toJSON()
            shape._highlightUid = node.uri
            shape.fill = "transparent"
            shape.stroke = yellow500
            resolve(shape)
        })    
    });

    obj.target = JSON.stringify(shape)
    return obj  
}

function parseTextQuoteSelector( node ) {
    const obj = {
        uri: node.uri,
        target: node.uri,
        excerpt: node[textQuoteExcerpt],
        color: yellow500
    }
    return obj  
}

function setupLogging() {
    logger = winston.createLogger({
        format: winston.format.printf(info => { return `${info.message}` }),
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ filename: logFile })
        ]
    });

    process.on('uncaughtException', function(err) {
        logger.log('error', `Fatal exception:\n${err}`, err, function(err, level, msg, meta) {
            process.exit(1);
        });
    });
}

async function createNodes(dataFile) {
    // Load the test.ttl file and parse it into a JSON object with the following structure:
    const triples = loadTTL(dataFile)

    // turn triples into a hash of subject nodes
    const nodes = []
    triples.forEach( (triple) => {
        const subject = convertURI(triple.subject.value)
        const predicate = convertURI(triple.predicate.value)

        let objectValue
        if( triple.object.termType === "NamedNode" ) {
            // special case for email addresses, which should not be escaped
            if( triple.object.value.startsWith('mailto:') ) {
                objectValue = triple.object.value
            } else {
                // otherwise this is an RDF Node pointer
                objectValue = convertURI(triple.object.value)
            }
        } else {
            // if this is a literal node, record its value
            objectValue = triple.object.value
        }

        if( !nodes[subject] ) nodes[subject] = { uri: subject }

        if( predicate === nodeType ) {
            // only accept node type valus in the vocab
            if( typeVocab.includes( objectValue ) ) {
                nodes[subject][predicate] = objectValue 
            } 
        } else if( predicate === aggregates ) {
            // if this is an aggregate, emit array
            if( !nodes[subject][predicate] ) nodes[subject][predicate] = []
            nodes[subject][predicate].push( objectValue )
        } else {
            nodes[subject][predicate] = objectValue 
        }
    })

    // store the nodes in mongo
    const nodeCollection = await mongoDB.collection('nodes')
    await nodeCollection.insertMany( Object.values(nodes) )
}

async function parseMostThings() {

    const users = await mongoDB.collection('users')
    const projects = await mongoDB.collection('projects')
    const documents = await mongoDB.collection('documents')
    const images = await mongoDB.collection('images')
    const highlights = await mongoDB.collection('highlights')
    let annotations = []

    // document schema for parsing HTML -> ProseMirror JSON
    const dmSchema = dmProseMirror.createDocumentSchema()

    // iterate through all the nodes and parse them into DM2 JSON
    let node
    const nodes = await mongoDB.collection('nodes')
    let nodeCursor = await nodes.find({})
    while( node = await nodeCursor.next() ) {
        switch( node[nodeType] ) {
            case userNode:
                await users.insertOne( parseUser(node) )
                break
            case projectNode:
                await projects.insertOne( parseProject(node) )
                break
            case textDocumentNode:
                await documents.insertOne( parseTextDocument(dmSchema,node) )
                break
            case imageDocumentNode:
                await documents.insertOne( parseImageDocument(node) )
                break
            case imageNode:
                await images.insertOne( parseImage(node) )
                break
            case annotationNode:
                annotations.push( parseAnnotation(node) )
                break
            case svgSelector:
                await highlights.insertOne( await parseSVGSelector(node) )
                break
            case textQuoteSelector:
                await highlights.insertOne( parseTextQuoteSelector(node) )
                break
            default:
                break
        }
    }

    return annotations
}

// Traverse the annotations and link up all the references
async function parseLinks(annotations) {
    const nodes = await mongoDB.collection('nodes')
    const links = await mongoDB.collection('links')
    const images = await mongoDB.collection('images')
    const documents = await mongoDB.collection('documents')

    for( let i=0; i < annotations.length; i++ ) {
        let annotation = annotations[i]
        const bodyNode = await nodes.findOne({ uri: annotation.body })
        const targetNode = await nodes.findOne({ uri: annotation.target })

        // Is this a canvas/image association or a link?
        if( bodyNode[nodeType] === imageNode ) {
            // associate the image with the imageDocument
            const bodyQ = { uri: bodyNode.uri }
            const targetQ = { uri: targetNode.uri }
            const image = await images.findOne(bodyQ)
            const imageDocument = await documents.findOne(targetQ)
            const imageSet = [ ...imageDocument.images, image.uri ]
            await documents.updateOne( targetQ, { $set: { images: imageSet }} )
        } else {
            // these two together make a link
            const linkA = await parseAnnotationLink( bodyNode, documents, nodes ) 
            const linkB = await parseAnnotationLink( targetNode, documents, nodes )
            await links.insertOne( { 
                linkUriA: linkA.uri, 
                linkTypeA: linkA.linkType, 
                linkUriB: linkB.uri, 
                linkTypeB: linkB.linkType
            })
        }
    }
}

// Go through all the projects and link up the documents 
function addDocumentsToProjects(dmData, annotations, nodes) {
    const { projects } = dmData

    const getDocumentURI = function( node ) {
        if( node[nodeType] !== imageNode ) {
            return node[nodeType] === specificResource ? node[ resourceSource ] : node.uri
        } else {
            return null
        }
    }

    projects.forEach( (project) => {
        logger.info(`Scanning annotations for documents in project ${project.uri}`)
        let projectDocs = []

        // first, mark all of the documents from the table of contents
        project.documents.forEach( documentURI => {
            let document = nodes[ documentURI ].obj
            document.projectURI = project.uri
            document.parentURI = project.uri
            document.parentType = 'Project'
            projectDocs.push(documentURI)
        })    

        // keep going as long as we are finding new documents 
        let prevCount = 0
        while(prevCount < projectDocs.length) {
            logger.info(`Found ${projectDocs.length - prevCount} new documents...`)
            prevCount = projectDocs.length
            annotations.forEach( annotation => {
                const bodyDocURI = getDocumentURI( nodes[annotation.body] )
                const targetDocURI = getDocumentURI( nodes[annotation.target] )
                if( bodyDocURI && targetDocURI ) {
                    let bodyDoc = nodes[bodyDocURI].obj
                    let targetDoc = nodes[targetDocURI].obj
                    // if two documents are linked by an annotation, they are in the same project.
                    if( projectDocs.includes( bodyDocURI ) && !projectDocs.includes( targetDocURI ) ) {
                        targetDoc.projectURI = project.uri
                        projectDocs.push(targetDocURI)            
                    } else if( projectDocs.includes( targetDocURI ) && !projectDocs.includes( bodyDocURI ) ) {
                        bodyDoc.projectURI = project.uri
                        projectDocs.push(bodyDocURI)            
                    }   
                    // if target doesn't have a parent, assign body  
                    if( !bodyDoc.parentURI ) {
                        bodyDoc.parentURI = targetDocURI
                        bodyDoc.parentType = 'Document'
                    }
                }
            })
        } 
        logger.info(`Done scanning project ${project.uri}`)   
    })

    // filter out documents that have no project association
    let unlinkedDocuments = 0
    dmData.documents = dmData.documents.filter( document => {
        if( !document.projectURI ) {
            logger.info(`Document not included: ${document.uri}`)
            unlinkedDocuments++
            return false
        } else {
            return true
        }
    })
    logger.info(`Found ${unlinkedDocuments} unlinked documents.`)

    // filter out highlights that have no document association
    let unlinkedHighlights = 0
    dmData.highlights = dmData.highlights.filter( highlight => {
        if( !highlight.documentURI ) {
            logger.info(`Highlight not included: ${highlight.uri}`)
            unlinkedHighlights++
            return false
        } else {
            return true
        }
    })
    logger.info(`Found ${unlinkedHighlights} unlinked highlights.`)
}

async function createGraph() {
    logger.info("Parsing most of the things...")
    let annotations = await parseMostThings()
    logger.info("Parsing links...")
    await parseLinks( annotations )
    // logger.info("Add Documents to Projects...")
    // addDocumentsToProjects( dmData, annotations, nodes )
}

async function parseAnnotationLink( node, documents, nodes ) {
    let uri, linkType
    if( node[nodeType] === specificResource ) {
        const resourceSourceQ = { uri: node[resourceSource] }
        const resourceSelectorQ = { uri: node[resourceSelector] }
        const source = await nodes.findOne(resourceSourceQ)
        const selector = await nodes.findOne(resourceSelectorQ)    
        await documents.updateOne( resourceSelectorQ, { $set: { documentURI: source.uri }})
        uri = selector.uri
        linkType = 'Highlight'
    } else {
        uri = node.uri
        linkType = 'Document'
    }
    return { uri, linkType }
}

async function dropCollections() {
    const collections = await mongoDB.collections()
    collections.forEach( async collection => {
        await collection.drop()
    })
}

async function runAsync() {
    const dataFile = 'ttl/test-image.ttl'
    // const dataFile = 'ttl/app.digitalmappa.org.ttl'

    mongoClient = await MongoClient.connect(mongoDatabaseURL)
    mongoDB = await mongoClient.db(mongoDatabaseName)   
    
    // clear object cache
    await dropCollections()

    logger.info("Loading RDF Nodes...")
    await createNodes(dataFile)

    logger.info("Creating DM2 Graph...")
    await createGraph()

    // TODO serialize graph 
    // fs.writeFileSync('ttl/test.json', JSON.stringify(dm2Graph))
    // fs.writeFileSync('ttl/test-mappa.json', JSON.stringify(dm2Graph))  
    await mongoClient.close()
}

function main() {
    setupLogging();
    logger.info("Starting TTL processing...")

    runAsync().then(() => {
        logger.info("TTL Processing completed.")   
    }, (err) => {
        logger.error(`${err}: ${err.stack}`)   
    });
}

///// RUN THE SCRIPT
main()