"""Real browser checks against the running development or preview server."""
import json
import base64
import os
import time
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('ATLAS_TEST_URL', 'http://127.0.0.1:5173')
ARTIFACTS = Path('/tmp/atlas-forge-tests')
ARTIFACTS.mkdir(exist_ok=True)

class EditorCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda err: self.errors.append(str(err)))
        self.page.goto(URL, wait_until='networkidle')
        self.page.wait_for_function("localStorage.getItem('atlas-forge-projects-v1') !== null")
        if not getattr(self,'beginner',False):
            self.page.get_by_role('button',name='Simple mode',exact=True).click()

    def tearDown(self):
        self.page.screenshot(path=str(ARTIFACTS / (self._testMethodName + '.png')))
        self.assertEqual(self.errors, [], 'Unexpected browser runtime errors')
        self.context.close()

    def world(self):
        self.page.wait_for_timeout(750)
        return self.page.evaluate("JSON.parse(localStorage.getItem('atlas-forge-projects-v1'))[0]")

    def position(self,x,y):
        return self.page.locator('#map-canvas').evaluate("(svg,p)=>{const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return {x:r.x+(p[0]-v.x)/v.width*r.width,y:r.y+(p[1]-v.y)/v.height*r.height}}",[x,y])

    def map_click(self,x,y):
        p=self.position(x,y)
        self.page.mouse.click(p['x'],p['y'])

    def stroke(self,points):
        p=self.position(*points[0]);self.page.mouse.move(p['x'],p['y']);self.page.mouse.down()
        for x,y in points[1:]:
            p=self.position(x,y);self.page.mouse.move(p['x'],p['y'],steps=4)
        self.page.mouse.up()

    def tool(self,name):
        self.page.get_by_role('button',name=name,exact=True).click()

    def new_blank(self):
        self.page.get_by_title('New world',exact=True).first.click()
        self.page.get_by_label('World name',exact=True).fill('Browser test world')
        self.page.get_by_role('button',name='A blank canvas',exact=False).click()
        self.page.get_by_role('button',name='Create world',exact=True).click()

class EditorWorkflows(EditorCase):
    def test_complete_edit_save_reload_workflow(self):
        self.new_blank()
        self.tool('Rectangle land');self.stroke([(250,200),(650,500)])
        self.assertEqual(len(self.world()['world']['lands']),1)
        self.tool('Draw territory')
        for p in [(260,210),(640,210),(640,490),(260,490)]:self.map_click(*p)
        self.page.keyboard.press('Enter')
        self.assertEqual(len(self.world()['world']['provinces']),1)
        self.tool('Split province');self.map_click(450,180);self.map_click(450,520)
        self.assertEqual(len(self.world()['world']['provinces']),2)
        self.page.get_by_role('button',name='New country',exact=True).click()
        self.page.get_by_label('Country name',exact=True).fill('Test Realm')
        self.page.get_by_role('button',name='Create country',exact=True).click()
        w=self.world()['world'];owner=next(c['id'] for c in w['countries'] if c['name']=='Test Realm')
        self.assertEqual(sum(p['countryId']==owner for p in w['provinces']),1)
        self.tool('Select');self.map_click(350,360);self.page.keyboard.down('Shift');self.map_click(550,360);self.page.keyboard.up('Shift')
        self.page.get_by_role('button',name='Merge',exact=True).click()
        self.assertEqual(len(self.world()['world']['provinces']),1)
        self.tool('City');self.map_click(350,300)
        self.page.get_by_label('Object name',exact=True).fill('Brightwater')
        self.tool('Castle');self.map_click(580,400)
        self.tool('River');self.stroke([(490,230),(500,275),(470,320),(480,380),(460,450)])
        self.tool('Road');self.stroke([(350,300),(400,310),(470,350),(580,400)])
        self.tool('Mountain brush');self.stroke([(350,230),(410,245),(440,250)])
        self.tool('Forest brush');self.stroke([(290,410),(315,425),(340,430)])
        self.tool('Label');self.map_click(410,440)
        self.page.get_by_label('Object name',exact=True).fill('The Green Vale')
        saved=self.world();kinds=[f['kind'] for f in saved['world']['features']]
        for kind in ['city','castle','river','road','mountain','forest','label']:self.assertIn(kind,kinds)
        self.tool('Select')
        self.page.keyboard.press('Control+z')
        undone=self.world();self.assertNotEqual(undone['world']['features'][-1]['name'],'The Green Vale')
        self.page.keyboard.press('Control+Shift+z')
        self.assertEqual(self.world()['world']['features'][-1]['name'],'The Green Vale')
        self.page.reload(wait_until='networkidle')
        reloaded=self.world();self.assertEqual(reloaded['world'],saved['world'])
        self.assertTrue(any(f['name']=='Brightwater' for f in reloaded['world']['features']))

    def test_exports_style_layers_and_backups(self):
        self.page.get_by_title('Hide Mountains & forests',exact=True).click()
        self.assertEqual(self.page.locator('[data-layer="terrain"]').count(),0)
        self.page.get_by_title('Show Mountains & forests',exact=True).click()
        self.assertEqual(self.page.locator('[data-layer="terrain"]').count(),1)
        self.page.get_by_label('Map style',exact=True).select_option('parchment')
        self.assertEqual(self.world()['world']['style'],'parchment')
        self.page.get_by_role('button',name='Export map',exact=True).first.click()
        self.page.get_by_label('Export format',exact=True).select_option('svg')
        with self.page.expect_download() as d:self.page.get_by_role('button',name='Export map',exact=True).last.click()
        path=ARTIFACTS/'map.svg';d.value.save_as(str(path));content=path.read_text()
        self.assertIn('<svg',content);self.assertIn('Eldoria',content);self.assertIn('data-object',content)
        self.page.get_by_role('button',name='Export map',exact=True).first.click()
        self.page.get_by_label('Export format',exact=True).select_option('png')
        with self.page.expect_download() as d:self.page.get_by_role('button',name='Export map',exact=True).last.click()
        path=ARTIFACTS/'map.png';d.value.save_as(str(path));self.assertEqual(path.read_bytes()[:8],b'\x89PNG\r\n\x1a\n')
        self.assertGreater(path.stat().st_size,50000)
        self.page.get_by_role('button',name='Export map',exact=True).first.click()
        self.page.get_by_label('Export format',exact=True).select_option('project')
        with self.page.expect_download() as d:self.page.get_by_role('button',name='Export backup',exact=True).click()
        path=ARTIFACTS/'backup.json';d.value.save_as(str(path));backup=json.loads(path.read_text());self.assertEqual(backup['version'],1)
        self.page.locator('.project-title').click()
        self.page.get_by_role('button',name='Import project / GeoJSON',exact=True).click()
        self.page.locator('input[type=file]').set_input_files(str(path))
        self.assertEqual(self.world()['world'],backup['world'])

    def test_snapshot_transfer_restore_and_linked_views(self):
        self.page.get_by_title('Historical snapshots',exact=True).click()
        self.page.get_by_label('Period name',exact=True).fill('Before the war')
        self.page.get_by_role('button',name='Capture era',exact=True).click()
        self.page.get_by_title('Close dialog',exact=True).click()
        stored=self.world();prov=stored['world']['provinces'][0];old_owner=prov['countryId'];new_owner=stored['world']['countries'][1]['id']
        self.page.locator(f'[data-object="{prov["id"]}"]').dispatch_event('click')
        self.page.get_by_label('Territorial owner',exact=True).select_option(new_owner)
        self.assertEqual(self.world()['world']['provinces'][0]['countryId'],new_owner)
        self.page.get_by_role('button',name='Create linked regional map',exact=True).click()
        self.page.get_by_label('Map name',exact=True).fill('Western province')
        self.page.get_by_role('button',name='Save',exact=True).click()
        self.assertEqual(len(self.world()['world']['views']),3)
        self.page.get_by_label('Active map view',exact=True).select_option('world')
        self.page.get_by_title('Historical snapshots',exact=True).click()
        self.page.get_by_role('button',name='Compare ownership',exact=True).click()
        self.assertTrue(self.page.locator('.compare-banner').is_visible())
        self.page.get_by_title('Historical snapshots',exact=True).click()
        self.page.get_by_role('button',name='Restore',exact=True).click()
        self.page.get_by_role('button',name='Confirm',exact=True).click()
        self.assertEqual(self.world()['world']['provinces'][0]['countryId'],old_owner)
        self.assertEqual(len(self.world()['snapshots']),1)

    def test_vertex_editing_and_locked_layers(self):
        self.new_blank()
        self.tool('Rectangle land');self.stroke([(250,200),(650,500)])
        self.tool('Draw territory')
        for p in [(260,210),(640,210),(640,490),(260,490)]:self.map_click(*p)
        self.page.keyboard.press('Enter')
        self.tool('Edit vertices');self.assertEqual(self.page.locator('.vertex-handle').count(),4)
        self.map_click(260,350)
        self.assertEqual(self.page.locator('.vertex-handle').count(),5)
        self.page.keyboard.down('Alt');self.map_click(260,350);self.page.keyboard.up('Alt')
        self.assertEqual(self.page.locator('.vertex-handle').count(),4)
        self.tool('City');self.map_click(350,300)
        before=len(self.world()['world']['features'])
        self.page.locator('.layer-row').filter(has_text='Cities & landmarks').get_by_title('Lock layer',exact=True).click()
        self.map_click(380,330)
        self.assertEqual(len(self.world()['world']['features']),before)
        self.assertIn('locked',self.page.get_by_role('status').inner_text())

    def test_image_references_biomes_and_label_styles(self):
        png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5GQAAAAASUVORK5CYII=')
        self.page.locator('input[type=file]').set_input_files({'name':'reference.png','mimeType':'image/png','buffer':png})
        self.page.wait_for_selector('[data-layer="references"]')
        self.page.get_by_label('Feature size',exact=True).fill('0.3')
        image=next(f for f in self.world()['world']['features'] if f['kind']=='image')
        self.assertTrue(image['asset']['dataUrl'].startswith('data:image/png;base64,'))
        self.assertEqual(image['size'],.3)
        self.tool('Biome brush');self.stroke([(550,440),(610,450),(630,480),(580,490),(550,440)])
        self.assertTrue(any(f['kind']=='biome' for f in self.world()['world']['features']))
        self.tool('Label');self.map_click(640,650)
        self.page.get_by_label('Object name',exact=True).fill('The forgotten shore')
        self.page.get_by_label('Label font',exact=True).select_option('Arial,sans-serif')
        self.page.get_by_label('Label outline',exact=True).check()
        label=self.world()['world']['features'][-1]
        self.assertEqual(label['font'],'Arial,sans-serif');self.assertTrue(label['outline'])

    def test_mobile_workspace(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.wait_for_timeout(150)
        self.assertEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.assertTrue(self.page.locator('#map-canvas').is_visible())
        before=len(self.world()['world']['features'])
        self.tool('City');self.map_click(550,420)
        self.assertEqual(len(self.world()['world']['features']),before+1)
        self.assertTrue(self.page.locator('.right-panel.has-selection').is_visible())
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('.right-panel').is_visible())

    def test_function_generation_validation_and_dialog_typing(self):
        health=self.page.request.get(f'{URL}/api/health')
        if health.status!=200 or 'application/json' not in health.headers.get('content-type',''):
            self.skipTest('Start Netlify functions alongside the app to test server integration.')
        self.page.get_by_title('New world',exact=True).first.click()
        name=self.page.get_by_label('World name',exact=True)
        name.fill('');name.press_sequentially('A server-built realm',delay=20)
        self.assertEqual(name.input_value(),'A server-built realm')
        self.page.get_by_role('button',name='A world of possibility',exact=False).click()
        with self.page.expect_response(lambda r:'/api/generate-world?' in r.url) as response:
            self.page.get_by_role('button',name='Create world',exact=True).click()
        self.assertEqual(response.value.status,200)
        self.page.get_by_role('status').filter(has_text='by the server').wait_for()
        project=self.world();self.assertEqual(project['name'],'A server-built realm')
        self.assertGreater(len(project['world']['provinces']),0)
        self.page.locator('.project-title').click()
        with self.page.expect_response(lambda r:r.url.endswith('/api/validate-project')) as response:
            self.page.get_by_role('button',name='Validate project',exact=True).click()
        self.assertEqual(response.value.status,200)
        self.page.get_by_role('status').filter(has_text='local and server validation').wait_for()

    def test_function_outage_keeps_generation_available(self):
        self.page.route('**/api/generate-world?*',lambda route:route.abort())
        self.page.get_by_title('New world',exact=True).first.click()
        self.page.get_by_label('World name',exact=True).fill('An offline realm')
        self.page.get_by_role('button',name='A world of possibility',exact=False).click()
        self.page.get_by_role('button',name='Create world',exact=True).click()
        self.page.get_by_role('status').filter(has_text='generated locally').wait_for()
        self.assertEqual(self.world()['name'],'An offline realm')

    def test_cancelled_generation_preserves_the_active_world(self):
        original=self.world()['id']
        held=[]
        self.page.route('**/api/generate-world?*',lambda route:held.append(route))
        self.page.get_by_title('New world',exact=True).first.click()
        self.page.get_by_role('button',name='A world of possibility',exact=False).click()
        self.page.get_by_role('button',name='Create world',exact=True).click()
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        self.assertEqual(len(held),1)
        held[0].abort()
        self.assertEqual(self.world()['id'],original)

    def test_unreadable_storage_recovery(self):
        original='{ damaged project storage }'
        self.page.evaluate("raw=>localStorage.setItem('atlas-forge-projects-v1',raw)",original)
        self.page.reload(wait_until='networkidle')
        self.assertEqual(self.page.evaluate("localStorage.getItem('atlas-forge-projects-v1')"),original)
        self.page.locator('.project-title').click()
        self.page.get_by_role('button',name='Recover local storage',exact=True).click()
        with self.page.expect_download() as d:self.page.get_by_role('button',name='Confirm',exact=True).click()
        path=ARTIFACTS/'storage-recovery.json';d.value.save_as(str(path));self.assertEqual(path.read_text(),original)
        self.assertEqual(self.world()['version'],1)

    def test_large_map_navigation(self):
        original=self.world();feature=next(f for f in original['world']['features'] if f['kind']=='forest')
        for count in [2000,5000]:
            base=json.loads(json.dumps(original))
            base['world']['features'] += [dict(feature,id=f'perf-{i}',points=[[160+i%100*9,180+(i//100)*10]]) for i in range(count)]
            self.page.evaluate("p=>localStorage.setItem('atlas-forge-projects-v1',JSON.stringify([p]))",base)
            start=time.perf_counter();self.page.reload(wait_until='networkidle');self.page.wait_for_selector(f'[data-feature="perf-{count-1}"]');load_ms=(time.perf_counter()-start)*1000
            start=time.perf_counter();self.page.get_by_title('Zoom in',exact=True).click();self.page.get_by_title('Zoom out',exact=True).click();navigate_ms=(time.perf_counter()-start)*1000
            print(f'Performance: {len(base["world"]["features"])} features; reload {load_ms:.0f} ms; two zoom actions {navigate_ms:.0f} ms')
            self.assertLess(load_ms,10000);self.assertLess(navigate_ms,5000)
            self.page.get_by_label('Active map view',exact=True).select_option(label='The Heartlands')
            self.assertLess(self.page.locator('[data-feature]').count(),len(base['world']['features']))

class CustomMapWorkflows(EditorCase):
    beginner=True

    def color(self,label,value):
        self.page.get_by_label(label,exact=True).evaluate("(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}",value)

    def custom_blank(self,width=1600,height=1000,grow=True):
        self.page.get_by_title('New world',exact=True).first.click()
        self.page.get_by_label('World name',exact=True).fill('My own world')
        self.page.get_by_label('World width',exact=True).fill(str(width))
        self.page.get_by_label('World height',exact=True).fill(str(height))
        if not grow:self.page.get_by_label('Let my canvas grow while I draw',exact=True).uncheck()
        self.page.get_by_role('button',name='Create world',exact=True).click()

    def country(self,name,color,government='Kingdom',members=None):
        self.page.get_by_role('button',name='Empire' if government=='Empire' else 'Country',exact=True).click()
        self.page.get_by_role('dialog',name='Raise a new realm',exact=True).get_by_label('Country name',exact=True).fill(name)
        self.page.get_by_label('Realm type',exact=True).fill(government)
        self.color('Custom country color',color)
        for member in members or []:self.page.get_by_label(member,exact=True).check()
        self.page.get_by_role('dialog',name='Raise a new realm',exact=True).get_by_role('button',name='Create country',exact=True).click()

    def test_custom_canvas_paint_resize_style_reload_and_svg(self):
        self.assertTrue(self.page.get_by_role('button',name='Simple mode',exact=True).is_visible())
        self.custom_blank(800,500)
        self.tool('Land brush');self.stroke([(160,180),(300,160),(460,220)])
        before=self.world();self.assertGreater(len(before['world']['lands']),0)
        self.tool('Move view');self.stroke([(400,250),(650,250)])
        self.tool('Land brush');self.map_click(-80,200)
        expanded=self.world();self.assertLess(expanded['world']['canvas']['x'],0)
        self.page.get_by_role('button',name='Canvas & colors',exact=True).click()
        self.page.get_by_label('Canvas width',exact=True).fill('12345')
        self.page.get_by_label('Canvas height',exact=True).fill('6789')
        self.page.get_by_role('button',name='Apply canvas size',exact=True).click()
        self.color('Water / background','#183245')
        self.color('Map border color','#aa33bb')
        self.page.get_by_label('Map border thickness',exact=True).fill('4')
        self.page.get_by_label('Map border style',exact=True).select_option('dashed')
        self.page.get_by_role('button',name='Done',exact=True).click()
        saved=self.world();self.assertEqual(saved['world']['canvas']['width'],12345)
        self.assertEqual(saved['world']['appearance']['ocean'],'#183245')
        self.assertEqual(saved['world']['appearance']['borderColor'],'#aa33bb')
        self.assertEqual(saved['world']['appearance']['borderWidth'],4)
        self.assertEqual(saved['world']['lands'],expanded['world']['lands'])
        self.page.reload(wait_until='networkidle')
        self.assertEqual(self.world()['world'],saved['world'])
        self.assertEqual(self.page.locator('#map-canvas [data-map-background="ocean"]').get_attribute('fill'),'#183245')
        self.page.get_by_role('button',name='Export map',exact=True).first.click()
        self.page.get_by_label('Export format',exact=True).select_option('svg')
        with self.page.expect_download() as d:self.page.get_by_role('button',name='Export map',exact=True).last.click()
        path=ARTIFACTS/'custom-world.svg';d.value.save_as(str(path));text=path.read_text()
        self.assertIn('12345 6789',text);self.assertIn('#183245',text)

    def test_custom_borders_colors_and_empire_lifecycle(self):
        self.custom_blank(1600,1000,False)
        self.tool('Rectangle');self.stroke([(200,200),(1400,700)])
        self.country('Azure Kingdom','#2288bb')
        self.tool('Give territory');self.map_click(450,400)
        self.assertEqual(len(self.world()['world']['provinces']),1)
        self.country('Red Dominion','#bb5566','Republic')
        self.tool('Draw border')
        for point in [(800,150),(1450,150),(1450,750),(800,750)]:self.map_click(*point)
        self.page.get_by_role('button',name='Finish border',exact=False).click()
        divided=self.world();self.assertEqual(len(divided['world']['provinces']),2)
        right=divided['world']['provinces'][-1]
        self.color('Province border color','#ffcc00')
        self.page.get_by_label('Province border thickness',exact=True).fill('5')
        self.page.get_by_label('Province border style',exact=True).select_option('dotted')
        self.assertEqual(self.world()['world']['provinces'][-1]['border']['color'],'#ffcc00')
        self.color('Drawing color','#aa3355');self.tool('Fill color');self.map_click(1100,400)
        painted=self.world();red=next(c for c in painted['world']['countries'] if c['name']=='Red Dominion')
        self.assertEqual(red['color'],'#aa3355')
        self.assertEqual(self.page.locator(f'[data-object="{right["id"]}"]').get_attribute('fill'),'#aa3355')
        self.page.keyboard.press('Control+z');self.assertNotEqual(next(c for c in self.world()['world']['countries'] if c['name']=='Red Dominion')['color'],'#aa3355')
        self.page.keyboard.press('Control+Shift+z')
        self.tool('City');self.map_click(450,360)
        owners={p['id']:p['countryId'] for p in self.world()['world']['provinces']}
        self.country('Great Empire','#668844','Empire',['Azure Kingdom','Red Dominion'])
        empire_state=self.world();empire=next(c for c in empire_state['world']['countries'] if c['name']=='Great Empire')
        self.assertEqual(empire_state['world']['politicalView'],'empires')
        self.assertEqual({p['id']:p['countryId'] for p in empire_state['world']['provinces']},owners)
        self.assertEqual(self.page.locator(f'[data-object="{right["id"]}"]').get_attribute('fill'),'#668844')
        self.page.get_by_role('button',name='Release Azure Kingdom',exact=True).click()
        self.assertIsNone(next(c for c in self.world()['world']['countries'] if c['name']=='Azure Kingdom')['parentId'])
        self.page.get_by_role('button',name='Dissolve realm',exact=True).click()
        self.page.get_by_role('button',name='Confirm',exact=True).click()
        final=self.world();self.assertFalse(any(c['id']==empire['id'] for c in final['world']['countries']))
        self.assertEqual({p['id']:p['countryId'] for p in final['world']['provinces']},owners)
        self.assertTrue(any(f['kind']=='city' for f in final['world']['features']))
        self.page.reload(wait_until='networkidle');self.assertEqual(self.world()['world'],final['world'])

    def test_land_eraser_and_undo_preserve_the_project(self):
        self.custom_blank(1200,820,False)
        self.tool('Rectangle');self.stroke([(200,200),(950,600)])
        self.tool('Give territory');self.map_click(400,400)
        initial=self.world()
        self.tool('Land eraser');self.stroke([(580,150),(580,650)])
        erased=self.world();self.assertNotEqual(erased['world']['lands'][0]['geometry'],initial['world']['lands'][0]['geometry'])
        self.assertNotEqual(erased['world']['provinces'][0]['geometry'],initial['world']['provinces'][0]['geometry'])
        self.page.keyboard.press('Control+z');self.assertEqual(self.world()['world'],initial['world'])
        self.page.keyboard.press('Control+Shift+z');self.assertEqual(self.world()['world'],erased['world'])

    def test_independent_generated_world_at_custom_dimensions(self):
        self.page.get_by_title('New world',exact=True).first.click()
        self.page.get_by_role('button',name='A world of possibility',exact=False).click()
        self.page.get_by_label('World width',exact=True).fill('3600')
        self.page.get_by_label('World height',exact=True).fill('2000')
        self.page.get_by_label('Landmasses',exact=True).fill('4')
        self.page.get_by_label('Starting countries',exact=True).fill('7')
        self.page.get_by_role('button',name='Create world',exact=True).click()
        self.page.get_by_role('dialog',name='Begin a new world',exact=True).wait_for(state='hidden')
        project=self.world()
        self.assertEqual(project['world']['canvas']['width'],3600)
        self.assertEqual(project['world']['canvas']['height'],2000)
        self.assertEqual(len(project['world']['lands']),4)
        self.assertEqual(len(project['world']['countries']),7)
        self.assertGreater(len(project['world']['provinces']),7)

if __name__ == '__main__':
    unittest.main(verbosity=2)
