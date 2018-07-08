const log = require('ilp-logger')('ilp-fetch')
const crypto = require('crypto')
const base64url = buffer => buffer.toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')

const STREAM_IDENTIFIER = 'interledger-stream'
const debug = require('debug')('ilp-fetch:stream')

async function handleStreamRequest ({
  url,
  opts,
  payParams,
  payToken
}) {
  const [ destinationAccount, _sharedSecret ] = payParams
  debug('streaming via STREAM. destination=' + destinationAccount)

  const sharedSecret = Buffer.from(_sharedSecret, 'base64')
  const connection = await window.monetize.createIlpConnection({
    destinationAccount,
    sharedSecret
  })

  const stream = connection.createStream()
  stream.setSendMax(opts.maxPrice)

  await new Promise(resolve => stream.on('data', resolve))

  const result = await fetch(url, opts)

  if (stream.isOpen()) {
    stream.end()
    // Wait for the stream 'end' event to be emitted so the stream can finish sending funds
    await new Promise(resolve => stream.once('end', resolve))
  }
  result.price = stream.totalSent
  return result
}

window.ilpFetch = async function (url, _opts) {
  // Generate the payment token to go along with our requests
  const payToken = _opts.payToken || crypto.randomBytes(16)
  const payTokenText = base64url(payToken)

  // Add the payment token to the headers
  const headers = Object.assign({},
    (_opts.headers || {}),
    { 'Pay-Token': payTokenText })

  // Make the request for the first time---if the endpoint is paid, this will
  // fail.
  log.info('attempting http request. url=' + url, 'opts=', _opts)
  const opts = Object.assign({}, _opts, { headers })
  const firstTry = await fetch(url, opts)

  // If the request succeeded, just return the result. Keep going if payment is
  // required.
  if (firstTry.status !== 402) {
    log.info('request is not paid. returning result.')
    firstTry.price = '0'
    return firstTry
  }

  const maxPrice = opts.maxPrice

  if (!maxPrice) {
    throw new Error('opts.maxPrice must be specified on paid request')
  }

  // Parse the `Pay` header to determine how to pay the receiver. A handler is
  // selected by checking what the payment method is.
  const [ payMethod, ...payParams ] = firstTry.headers.get('Pay').split(' ')
  log.trace('parsed `Pay` header. method=' + payMethod, 'params=', payParams)

  let handler
  switch (payMethod) {
    case STREAM_IDENTIFIER:
      log.trace('using STREAM handler.')
      handler = handleStreamRequest
      break

    case PSK_2_IDENTIFIER:
      log.warn('PSK2 is no longer supported. use `superagent-ilp` for legacy PSK.')
    case PSK_IDENTIFIER:
      log.warn('PSK1 is no longer supported. use `superagent-ilp` for legacy PSK.')
    default:
      log.error('no handler exists for payment method. method=' + payMethod)
      throw new Error('unsupported payment method in `Pay`. ' +
        'header=' + firstTry.headers.get('Pay'))
  }

  log.trace('calling handler.')
  return handler({ firstTry, url, opts, payParams, payToken })
}

const domain = new URL(window.location).origin

window.close_image = function close_image () {
  document.getElementById('image-viewer-error').style = 'display:none;'
  document.getElementById('image-viewer-not-registered').style = 'display:none;'
  document.getElementById('image-viewer-content').style = 'display:none;'
  document.getElementById('image-viewer').style = 'display:none;'
}

window.view_photo = async function view_photo (name, free) {
  var viewer = document.getElementById('image-viewer')
  var photo = document.getElementById('image-viewer-content')
  var unregistered = document.getElementById('image-viewer-not-registered')
  var error = document.getElementById('image-viewer-error')
  var url = (free ? '/freecontent/' : '/content/') + name
  viewer.style = 'display:block;'

  try {
    const res = await window.ilpFetch(url, {
      maxPrice: '200'
    })

    const blob = await res.blob()
    const dataUrl = URL.createObjectURL(blob)

    photo.style = ''
    photo.src = dataUrl
    console.log('viewing file', url) 
  } catch (e) {
    if (e.name === 'NoHandlerRegisteredError') {
      console.log('UNREGISTERED')
      unregistered.style = ''      
    } else {
      console.log('ERROR', e)
      error.style = ''
      document.getElementById('image-viewer-error-message').innerText = e.message
    }
  }
}
