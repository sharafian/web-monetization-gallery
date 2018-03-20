const Koa = require('koa')
const router = require('koa-router')()
const serve = require('koa-static')('./static')
const app = new Koa()

const KoaWebMonetization = require('koa-web-monetization')
const monetization = new KoaWebMonetization({ maxBalance: 25 })

const fs = require('fs-extra')
const path = require('path')

router.get('/client.js', async ctx => {
  ctx.body = await fs.readFile(path.resolve(__dirname, 'node_modules/koa-web-monetization/client.js'))
})

router.get('/pay/:id', monetization.receiver())

router.get('/content/:id/:file_name', monetization.paid({ price: 25, awaitBalance: true }), async ctx => {
  const sanitizedFile = ctx.params.file_name.replace(/[^a-zA-Z0-9]/g, '')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'res/' + sanitizedFile + '.jpg'))
})

router.get('/freecontent/:id/:file_name', async ctx => {
  const sanitizedFile = ctx.params.file_name.replace(/[^a-zA-Z0-9]/g, '')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'static/free/' + sanitizedFile + '.jpg'))
})

app
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve)
  .listen(8080)
