#!/usr/bin/env python3
"""
eVSM Local Proxy — forwards Anthropic API calls from the browser.
Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 evsm-proxy.py

Then open evsm-aggregator.html via http://localhost:8765
"""
import os, json, urllib.request, urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8765
API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
PROXY_SECRET = os.environ.get('SODOTO_PROXY_SECRET', '')
eVSM_DIR = os.path.dirname(os.path.abspath(__file__))
_wiki_data = os.environ.get('WIKI_DATA_DIR', os.path.expanduser('~/.wiki'))
WIKI_PAGES_DIR = os.path.join(_wiki_data, 'localhost', 'pages')
PEOPLE_REGISTRY_FILE = os.path.expanduser('~/.sodoto/people-registry.json')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {args[0]} {args[1]}")

    def _auth_ok(self):
        """Return True if request carries a valid bearer token (or no secret is configured)."""
        if not PROXY_SECRET:
            return True
        auth = self.headers.get('Authorization', '')
        return auth == f'Bearer {PROXY_SECRET}'

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/wiki-read-page'):
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            site = os.path.basename(qs.get('site', [''])[0])
            slug = os.path.basename(qs.get('slug', [''])[0])
            if not site or not slug:
                self.send_response(400); self._cors(); self.end_headers()
                self.wfile.write(b'Missing site or slug'); return
            page_path = os.path.join(_wiki_data, site, 'pages', slug)
            try:
                with open(page_path, 'r', encoding='utf-8') as f:
                    data = f.read().encode()
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
            except FileNotFoundError:
                self.send_response(404); self._cors(); self.end_headers()
                self.wfile.write(b'Page not found')
            return

        if self.path.startswith('/api/people-registry'):
            try:
                with open(PEOPLE_REGISTRY_FILE, 'r', encoding='utf-8') as f:
                    data = f.read().encode()
            except FileNotFoundError:
                data = b'{"people":[]}'
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data)
            return

        # Serve local files
        path = self.path.split('?')[0].lstrip('/')
        if not path:
            path = 'evsm-aggregator.html'
        filepath = os.path.join(eVSM_DIR, path)
        if os.path.isfile(filepath):
            ext = path.rsplit('.', 1)[-1]
            ctype = {'html':'text/html','json':'application/json',
                     'js':'text/javascript','css':'text/css'}.get(ext,'text/plain')
            with open(filepath, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            if ext == 'html':
                self.send_header('Cache-Control', 'no-store')
            self._cors()
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')

    def do_POST(self):
        if self.path == '/api/write-issue':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                payload    = json.loads(body)
                # Sanitise key — no path traversal
                key        = payload['key'].replace('..', '').replace('/', '').replace('\\', '')
                label      = payload['label']
                ndc        = payload['ndc']
                issue_data = payload['issueData']

                issue_dir  = os.path.join(eVSM_DIR, 'tools', 'issue-data')
                os.makedirs(issue_dir, exist_ok=True)

                # Write issue JSON
                issue_path = os.path.join(issue_dir, key + '.json')
                with open(issue_path, 'w', encoding='utf-8') as f:
                    json.dump(issue_data, f, ensure_ascii=False, indent=2)
                print(f"  ISSUE WRITE {issue_path}")

                # Upsert entry in issue-index.json
                index_path = os.path.join(issue_dir, 'issue-index.json')
                try:
                    with open(index_path, 'r', encoding='utf-8') as f:
                        index = json.load(f)
                except (FileNotFoundError, json.JSONDecodeError):
                    index = []

                entry = {
                    'key':   key,
                    'label': label,
                    'ndc':   ndc,
                    'url':   f'http://localhost:8765/tools/issue-data/{key}.json',
                    'map':   f'http://localhost:8765/tools/issue-polygon-map.html?issue={key}'
                }
                pos = next((i for i, e in enumerate(index) if e.get('key') == key), None)
                if pos is not None:
                    index[pos] = entry
                else:
                    index.append(entry)
                with open(index_path, 'w', encoding='utf-8') as f:
                    json.dump(index, f, ensure_ascii=False, indent=2)
                print(f"  ISSUE INDEX {len(index)} entries")

                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'key': key}).encode())
            except Exception as e:
                self.send_response(500); self._cors(); self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
            return

        if self.path == '/api/wiki-save-item':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            site = os.path.basename(body.get('site', ''))
            slug = os.path.basename(body.get('slug', ''))
            item_id = body.get('id', '')
            updates = body.get('updates', {})
            page_path = os.path.join(_wiki_data, site, 'pages', slug)
            try:
                with open(page_path, 'r', encoding='utf-8') as f:
                    page = json.load(f)
                for item in page.get('story', []):
                    if item.get('id') == item_id:
                        item.update(updates)
                        break
                with open(page_path, 'w', encoding='utf-8') as f:
                    json.dump(page, f)
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
            return

        if not self._auth_ok():
            self.send_response(401)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error":"Unauthorized"}')
            return

        if self.path == '/api/people-registry':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                os.makedirs(os.path.dirname(PEOPLE_REGISTRY_FILE), exist_ok=True)
                with open(PEOPLE_REGISTRY_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"  REGISTRY WRITE {len(data.get('people', []))} people")
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(500); self._cors(); self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path == '/api/wiki-write':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                slug = payload['slug']
                page = payload['page']
                # Sanitize slug — no path traversal
                slug = os.path.basename(slug)
                dest = os.path.join(WIKI_PAGES_DIR, slug)
                os.makedirs(WIKI_PAGES_DIR, exist_ok=True)
                with open(dest, 'w', encoding='utf-8') as f:
                    json.dump(page, f, ensure_ascii=False, indent=2)
                print(f"  WIKI WRITE {dest}")
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'slug': slug}).encode())
            except Exception as e:
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path == '/api/finalize-contract':
            import base64, datetime
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                contract = data.get('contract', {})
                neo4j_password = 'sucramsucram'
                results = {'neo4j': None, 'fedwiki': [], 'errors': []}

                cid     = contract.get('id','')
                cust    = contract.get('parties',{}).get('customer',{})
                perf    = contract.get('parties',{}).get('performer',{})
                pay     = contract.get('payment_spec',{})
                cos     = contract.get('preconditions',{}).get('conditions_of_satisfaction',{})
                sbu     = contract.get('preconditions',{}).get('shared_background_of_understanding',{})
                status  = contract.get('cfa_state',{}).get('current','initiated')
                created = contract.get('created_at', datetime.datetime.utcnow().isoformat())
                short_id = cid.replace('urn:uuid:','')[:8].upper()
                created_date = created[:10]

                # Neo4j
                try:
                    cypher = """
MERGE (cu:Party {did: $cust_did}) SET cu.name = $cust_name
MERGE (pe:Party {did: $perf_did}) SET pe.name = $perf_name
MERGE (c:Contract {id: $cid})
  SET c.created_at = $created, c.status = $status,
      c.conditions = $conditions, c.deadline = $deadline,
      c.total_usd = $total_usd, c.fiat_min_usd = $fiat_min_usd,
      c.version = $version
MERGE (cu)-[:CUSTOMER_IN]->(c)
MERGE (pe)-[:PERFORMER_IN]->(c)
"""
                    params = {
                        'cust_did': cust.get('did',''), 'cust_name': cust.get('name',''),
                        'perf_did': perf.get('did',''), 'perf_name': perf.get('name',''),
                        'cid': cid, 'created': created, 'status': status,
                        'conditions': cos.get('description',''), 'deadline': cos.get('deadline',''),
                        'total_usd': pay.get('total_value_usd',0),
                        'fiat_min_usd': pay.get('fiat_min_usd',0),
                        'version': contract.get('version','0.1')
                    }
                    neo4j_body = json.dumps({'statements':[{'statement':cypher,'parameters':params}]}).encode()
                    token = base64.b64encode(f'neo4j:{neo4j_password}'.encode()).decode()
                    req = urllib.request.Request(
                        'http://localhost:7474/db/neo4j/tx/commit',
                        data=neo4j_body,
                        headers={'Content-Type':'application/json','Authorization':f'Basic {token}'}
                    )
                    urllib.request.urlopen(req, timeout=10)
                    results['neo4j'] = 'ok'
                except Exception as e:
                    results['errors'].append(f'neo4j: {e}')

                # FedWiki
                pay_summary = f"Total: ${pay.get('total_value_usd',0)} · Fiat min: ${pay.get('fiat_min_usd',0)}"
                if pay.get('fiat_per_hour'):
                    pay_summary += f" · {pay.get('time_max_pct',0)}% time @ ${pay.get('fiat_per_hour',0)}/hr"
                gift = pay.get('gift',{})
                if gift and gift.get('type','none') != 'none':
                    pay_summary += f" · {gift.get('type','')} gift ${gift.get('amount_usd',0)}"

                party_configs = [
                    (cust.get('name','Customer'), 'customer', 'patient-a.localhost',
                     perf.get('name',''), 'community-health-worker-a.localhost'),
                    (perf.get('name','Performer'), 'performer', 'community-health-worker-a.localhost',
                     cust.get('name',''), 'patient-a.localhost'),
                ]

                for (own_name, own_role, own_host, other_name, other_host) in party_configs:
                    try:
                        slug = 'contract-' + short_id.lower()
                        ledger_slug = own_name.lower().replace(' ','-') + '-contracts'
                        now_ms = int(datetime.datetime.utcnow().timestamp()*1000)

                        page = {
                            'title': f'Contract {short_id}',
                            'story': [
                                {'type':'paragraph','id':'p1','text':f'**{own_role.title()}**: {own_name} · **Counterparty**: {other_name}'},
                                {'type':'paragraph','id':'p2','text':f'**Conditions**: {cos.get("description","")}'},
                                {'type':'paragraph','id':'p3','text':f'**Deadline**: {cos.get("deadline","")} · **Status**: {status}'},
                                {'type':'paragraph','id':'p4','text':f'**Payment**: {pay_summary}'},
                                {'type':'paragraph','id':'p5','text':f'**SBU**: {sbu.get("status","")}' + (f' · {sbu.get("note","")}' if sbu.get("note") else "")},
                                {'type':'paragraph','id':'p6','text':f'**Contract ID**: {cid}'},
                                {'type':'paragraph','id':'p7','text':f'**Created**: {created_date}'},
                                {'type':'reference','id':'p8','site':other_host,'slug':slug,
                                 'title':f'Contract {short_id}','text':f'View from {other_name}'},
                            ],
                            'journal': [{'type':'create','id':'j1',
                                'item':{'title':f'Contract {short_id}'},'date':now_ms}]
                        }

                        wiki_dir = os.path.join(_wiki_data, own_host, 'pages')
                        os.makedirs(wiki_dir, exist_ok=True)
                        with open(os.path.join(wiki_dir, slug), 'w', encoding='utf-8') as f:
                            json.dump(page, f, ensure_ascii=False, indent=2)

                        # Ledger page
                        ledger_path = os.path.join(wiki_dir, ledger_slug)
                        try:
                            existing = json.load(open(ledger_path, encoding='utf-8'))
                        except:
                            existing = {'title':f'{own_name} Contracts','story':[],'journal':[]}

                        existing['story'].append({
                            'type':'reference','id':'r-'+short_id.lower(),
                            'site':own_host,'slug':slug,
                            'title':f'Contract {short_id}',
                            'text':f'{created_date} · {other_name} · deadline {cos.get("deadline","")}'
                        })
                        existing['journal'].append({'type':'edit','id':'j-'+short_id.lower(),'date':now_ms})
                        with open(os.path.join(wiki_dir, ledger_slug), 'w', encoding='utf-8') as f:
                            json.dump(existing, f, ensure_ascii=False, indent=2)
                        results['fedwiki'].append(f'{own_host}: ok')
                    except Exception as e:
                        results['errors'].append(f'fedwiki {own_host}: {e}')

                self.send_response(200)
                self._cors()
                self.send_header('Content-Type','application/json')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode())
            except Exception as e:
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path == '/api/wiki-write-badge':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                site      = payload['site']
                slug      = payload['slug']
                badge_item = payload['badgeItem']
                # Sanitize — no path traversal
                site = os.path.basename(site)
                slug = os.path.basename(slug)
                pages_dir = os.path.join(_wiki_data, site, 'pages')
                os.makedirs(pages_dir, exist_ok=True)
                page_path = os.path.join(pages_dir, slug)
                now_ms = int(__import__('time').time() * 1000)
                # Load existing page or create a skeleton
                try:
                    with open(page_path, 'r', encoding='utf-8') as f:
                        page = json.load(f)
                except FileNotFoundError:
                    page = {
                        'title': slug.replace('-', ' ').title(),
                        'story': [],
                        'journal': [{'type': 'create', 'id': 'init', 'date': now_ms,
                                     'item': {'title': slug.replace('-', ' ').title()}}]
                    }
                # Upsert: find existing badge by contractId, replace in-place; otherwise append
                if 'story' not in page:
                    page['story'] = []
                contract_id = (badge_item.get('credential') or {}).get('contractId')
                existing_idx = None
                if contract_id:
                    for idx, item in enumerate(page['story']):
                        if item.get('type') == 'sodoto-badge' and \
                           (item.get('credential') or {}).get('contractId') == contract_id:
                            existing_idx = idx
                            break
                if 'journal' not in page:
                    page['journal'] = []
                if existing_idx is not None:
                    # Keep original item id, update credential data in-place
                    original_id = page['story'][existing_idx]['id']
                    badge_item['id'] = original_id
                    page['story'][existing_idx] = badge_item
                    page['journal'].append({
                        'type': 'edit',
                        'id': original_id,
                        'date': now_ms,
                        'item': badge_item
                    })
                else:
                    page['story'].append(badge_item)
                    page['journal'].append({
                        'type': 'add',
                        'id': badge_item.get('id', 'unknown'),
                        'date': now_ms,
                        'item': badge_item
                    })
                with open(page_path, 'w', encoding='utf-8') as f:
                    json.dump(page, f, ensure_ascii=False, indent=2)
                print(f"  BADGE WRITE {page_path}")
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'slug': slug}).encode())
            except Exception as e:
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path == '/api/wiki-update-item':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                import time
                payload = json.loads(body)
                site    = os.path.basename(payload['site'])
                slug    = os.path.basename(payload['slug'])
                item_id = payload['itemId']
                text    = payload['text']
                page_path = os.path.join(_wiki_data, site, 'pages', slug)
                with open(page_path, 'r', encoding='utf-8') as f:
                    page = json.load(f)
                updated = False
                for item in page.get('story', []):
                    if item.get('id') == item_id:
                        item['text'] = text
                        updated = True
                        break
                if not updated:
                    raise KeyError(f'Item {item_id} not found in {slug}')
                now_ms = int(time.time() * 1000)
                page.setdefault('journal', []).append(
                    {'type': 'edit', 'id': item_id, 'date': now_ms,
                     'item': {'id': item_id, 'type': 'paragraph', 'text': text}})
                with open(page_path, 'w', encoding='utf-8') as f:
                    json.dump(page, f, ensure_ascii=False, indent=2)
                print(f"  ITEM UPDATE {site}/{slug}#{item_id}")
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode())
            except Exception as e:
                self.send_response(500); self._cors(); self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path == '/api/wiki-add-items':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                import time
                payload = json.loads(body)
                site  = os.path.basename(payload['site'])
                slug  = os.path.basename(payload['slug'])
                items = payload['items']
                page_path = os.path.join(_wiki_data, site, 'pages', slug)
                now_ms = int(time.time() * 1000)
                try:
                    with open(page_path, 'r', encoding='utf-8') as f:
                        page = json.load(f)
                except FileNotFoundError:
                    page = {'title': slug.replace('-', ' ').title(),
                            'story': [], 'journal': [
                                {'type': 'create', 'id': 'init', 'date': now_ms,
                                 'item': {'title': slug.replace('-', ' ').title()}}]}
                page.setdefault('story', [])
                page.setdefault('journal', [])
                for item in items:
                    page['story'].append(item)
                    page['journal'].append({'type': 'add', 'id': item.get('id', 'unknown'),
                                            'date': now_ms, 'item': item})
                with open(page_path, 'w', encoding='utf-8') as f:
                    json.dump(page, f, ensure_ascii=False, indent=2)
                print(f"  ADD ITEMS  {site}/{slug} +{len(items)}")
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'added': len(items)}).encode())
            except Exception as e:
                self.send_response(500); self._cors(); self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path == '/api/wiki-write-page':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                site = os.path.basename(payload['site'])
                slug = os.path.basename(payload['slug'])
                page = payload['page']
                pages_dir = os.path.join(_wiki_data, site, 'pages')
                os.makedirs(pages_dir, exist_ok=True)
                page_path = os.path.join(pages_dir, slug)
                with open(page_path, 'w', encoding='utf-8') as f:
                    json.dump(page, f, ensure_ascii=False, indent=2)
                print(f"  PAGE WRITE {site}/{slug}")
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'slug': slug}).encode())
            except Exception as e:
                self.send_response(500); self._cors(); self.end_headers()
                self.wfile.write(str(e).encode())
            return

        if self.path != '/api/anthropic':
            self.send_response(404); self.end_headers(); return

        if not API_KEY:
            self.send_response(500); self._cors(); self.end_headers()
            self.wfile.write(b'ANTHROPIC_API_KEY not set'); return

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body,
            headers={
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01'
            },
            method='POST'
        )
        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                self._cors()
                # Forward streaming headers
                ct = resp.headers.get('Content-Type','application/json')
                self.send_header('Content-Type', ct)
                self.end_headers()
                # Stream chunks through
                while True:
                    chunk = resp.read(1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except urllib.error.HTTPError as e:
            err = e.read()
            self.send_response(e.code)
            self._cors()
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(err)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')

if __name__ == '__main__':
    if not API_KEY:
        print("⚠  ANTHROPIC_API_KEY not set — synthesis will not work.")
        print("   Set it with: export ANTHROPIC_API_KEY=sk-ant-...")
    print(f"eVSM Proxy running at http://localhost:{PORT}")
    print(f"Serving files from: {eVSM_DIR}")
    print(f"Open: http://localhost:{PORT}/evsm-aggregator.html")
    print("Ctrl+C to stop.\n")
    if PROXY_SECRET:
        print(f"Auth: Bearer token required (SODOTO_PROXY_SECRET is set)")
    else:
        print(f"⚠  SODOTO_PROXY_SECRET not set — API endpoints are open.")
    HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
