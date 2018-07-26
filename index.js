const Koa = require('koa')
const router = require('koa-router')()
const path = require('path')
const serve = require('koa-static')(path.resolve(__dirname, 'static'))
const app = new Koa()

const KoaCog = require('@sharafian/cog')
const cog = new KoaCog()
const fs = require('fs-extra')

router.get('/client.js', async ctx => {
  ctx.body = await fs.readFile(path.resolve(__dirname, 'dist', 'client.js'))
})

router.get('/content/:file_name', cog.paid(), async ctx => {
  try {
    await ctx.ilpStream.receiveTotal('100')
  } catch (e) {
    ctx.throw(402, 'insufficient payment on request')
    return
  }

  const sanitizedFile = ctx.params.file_name.replace(/[^a-zA-Z0-9]/g, '')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'res/' + sanitizedFile + '.jpg'))
})

router.get('/freecontent/:file_name', async ctx => {
  const sanitizedFile = ctx.params.file_name.replace(/[^a-zA-Z0-9]/g, '')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'static/free/' + sanitizedFile + '.jpg'))
})

app
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve)
  .listen(8085)
