import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':800})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        await pg.goto(sys.argv[1]); await pg.wait_for_function('window.__loaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.screenshot(path='shots/orbit.png')
        def gi(g,name): return f"window.__tour.goto('{g}', window.__tour.ROOMS.{g}.findIndex(r=>r[0].startsWith('{name}')))"
        for g,n,f in [('gf','Гостиная','living_walk'),('gf','Сауна','sauna'),('gf','Кухня','kitchen'),('sf','Спальня мастер','master'),('ext','С улицы','street')]:
            await pg.evaluate(gi(g,n)); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'shots/{f}.png')
        await pg.evaluate("document.getElementById('evening').click()"); await pg.evaluate(gi('ext','Из сада')); await pg.wait_for_timeout(2000); await pg.screenshot(path='shots/evening_garden.png')
        await pg.evaluate("document.getElementById('evening').click(); document.getElementById('hide2').click()"); await pg.wait_for_timeout(2000); await pg.screenshot(path='shots/hide2.png')
        # walk test
        await pg.evaluate(gi('gf','Гостиная')); p0=await pg.evaluate("window.__tour.camera.position.toArray()")
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(4000); await pg.keyboard.up('KeyW')
        p1=await pg.evaluate("window.__tour.camera.position.toArray()"); print('walk',p0,p1)
        print('ERRORS', errs); await b.close()
asyncio.run(main())
