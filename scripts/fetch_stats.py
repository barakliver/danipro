#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fetch public engagement stats (likes, plays, comments, username) for each
reel in the catalog, via the private media-info endpoint, using the owner's
cookie. Writes stats.json keyed by shortcode.

Note on "views": Instagram's public number is the PLAY count (includes
replays). True unique-accounts-reached lives only in the owner's private
Insights and is not available through any API.
"""
import csv, json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import taxonomy as T
import ig_dm

ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'


def shortcode_to_id(code):
    n = 0
    for ch in code:
        n = n * 64 + ALPHA.index(ch)
    return n


def code_of(url):
    m = re.search(r'/p/([^/]+)/', url)
    return m.group(1) if m else url


def fetch(code):
    mid = shortcode_to_id(code)
    d = ig_dm.get('https://www.instagram.com/api/v1/media/{}/info/'.format(mid))
    items = d.get('items')
    if not items:
        return None
    m = items[0]
    ts = m.get('taken_at') or m.get('device_timestamp')
    return {
        'username': (m.get('user') or {}).get('username'),
        'likes': m.get('like_count'),
        'plays': m.get('play_count') or m.get('ig_play_count') or m.get('view_count'),
        'comments': m.get('comment_count'),
        'taken_at': ts,
    }


def main():
    out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            'stats.json')
    stats = {}
    if os.path.exists(out_path):
        stats = json.load(open(out_path))
    with open(T.CSV_PATH, encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.reader(fh))[1:]
    todo = [(r[0], code_of(r[1])) for r in rows]
    todo = [(idx, c) for idx, c in todo if c not in stats or stats.get(c, {}).get('taken_at') is None]
    print('לשליפה: {} (כבר יש: {})'.format(len(todo), len(stats)), flush=True)
    for i, (idx, c) in enumerate(todo, 1):
        for attempt in range(3):
            try:
                s = fetch(c)
            except Exception as e:
                s = None
            if s and s.get('taken_at') is not None:
                stats[c] = s
                break
            time.sleep(20 * (attempt + 1))
        if c not in stats:
            stats[c] = {'username': None, 'likes': None, 'plays': None, 'comments': None}
            print('  {} {} FAILED'.format(idx, c), flush=True)
        if i % 10 == 0:
            json.dump(stats, open(out_path, 'w'), ensure_ascii=False)
            print('  {}/{} '.format(i, len(todo)), flush=True)
        time.sleep(2)
    json.dump(stats, open(out_path, 'w'), ensure_ascii=False)
    got = sum(1 for v in stats.values() if v.get('plays') is not None)
    print('DONE — עם נתונים: {}/{}'.format(got, len(stats)))


if __name__ == '__main__':
    main()
