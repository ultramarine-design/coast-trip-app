#!/usr/bin/env python3
"""안심식당 앱의 전국 데이터에서 일정 경유지 거점 식당을 뽑아 data/restaurants.json을 만든다.
거점: 군과 시의 읍면은 주소의 읍면 이름으로, 시의 동 지역은 '시내'로 묶는다(도로명 주소에 동 이름이 없어서).
사용: python3 build_restaurants.py
"""
import glob, json, os, re
H = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(H, '..', '..', 'claude cowork', '안심식당-앱', 'data')

# (id, 표시 이름, 시군구, 읍면 또는 None=동 지역 전체)
HUBS = [
    ('tongyeong', '통영 시내', '통영시', None),
    ('namhae-samdong', '남해 삼동면(독일마을)', '남해군', '삼동면'),
    ('namhae-nam', '남해 남면(다랭이마을)', '남해군', '남면'),
    ('yeosu', '여수 시내', '여수시', None),
    ('yeosu-dolsan', '여수 돌산읍', '여수시', '돌산읍'),
    ('boseong-beolgyo', '보성 벌교읍', '보성군', '벌교읍'),
    ('boseong', '보성읍(대한다원)', '보성군', '보성읍'),
    ('haenam-songji', '해남 송지면(땅끝)', '해남군', '송지면'),
    ('haenam', '해남읍', '해남군', '해남읍'),
    ('mokpo', '목포 시내', '목포시', None),
    ('buan-byeonsan', '부안 변산면(격포)', '부안군', '변산면'),
    ('buan-jinseo', '부안 진서면(내소사·곰소)', '부안군', '진서면'),
    ('gunsan', '군산 시내', '군산시', None),
    ('danyang', '단양읍', '단양군', '단양읍'),
    ('yeongwol', '영월읍', '영월군', '영월읍'),
    ('gangneung', '강릉 시내', '강릉시', None),
    ('gangneung-yeongok', '강릉 연곡면', '강릉시', '연곡면'),
    ('gangneung-gangdong', '강릉 강동면(정동진)', '강릉시', '강동면'),
    ('samcheok-geundeok', '삼척 근덕면(장호항)', '삼척시', '근덕면'),
    ('uljin-hupo', '울진 후포면', '울진군', '후포면'),
    ('yeongdeok-ganggu', '영덕 강구면', '영덕군', '강구면'),
    ('pohang-guryongpo', '포항 구룡포읍', '포항시', '구룡포읍'),
    ('gyeongju-gampo', '경주 감포읍', '경주시', '감포읍'),
    ('gyeongju-munmu', '경주 문무대왕면', '경주시', '문무대왕면'),
]

rows = []
for f in sorted(glob.glob(os.path.join(SRC, 'sido-*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    rows += [dict(zip(d['fields'], r)) for r in d['rows']]
updated = json.load(open(os.path.join(SRC, 'index.json'), encoding='utf-8'))['updated']

def emd(ad, gu):
    # 주소에서 시군구 바로 뒤 토큰. 읍/면이면 그 이름, 아니면 None(동 지역)
    m = re.search(re.escape(gu) + r'\s+(?:[^\s]+구\s+)?([^\s]+(?:읍|면))\s', ad + ' ')
    return m.group(1) if m else None

# 일정에 적은 그 지역 대표 메뉴. 상호에 들어 있으면 목록 위로 올리고 표시한다.
KW = {
    'tongyeong': ['충무김밥', '시락', '복국', '굴', '멍게'], 'namhae-samdong': ['멸치'], 'namhae-nam': ['멸치'],
    'yeosu': ['서대', '갓김치', '게장', '장어'], 'yeosu-dolsan': ['갓김치', '게장', '서대'],
    'boseong-beolgyo': ['꼬막'], 'boseong': ['녹차', '꼬막'], 'haenam-songji': ['횟집', '회센터', '활어', '전복'], 'haenam': ['한정식', '닭'],
    'mokpo': ['낙지', '민어', '홍어', '꽃게'], 'buan-byeonsan': ['바지락', '백합', '횟집', '회센터', '활어'], 'buan-jinseo': ['젓갈', '바지락', '백합'],
    'gunsan': ['짬뽕', '꽃게', '박대'], 'danyang': ['마늘'], 'yeongwol': ['곤드레', '다슬기'],
    'gangneung': ['순두부', '장칼국수', '감자'], 'gangneung-yeongok': ['순두부'], 'gangneung-gangdong': ['횟집', '회센터', '활어', '물회'],
    'samcheok-geundeok': ['곰치', '물회', '횟집', '회센터', '활어'], 'uljin-hupo': ['물회', '대게', '횟집', '회센터', '활어'], 'yeongdeok-ganggu': ['물회', '대게', '횟집', '회센터', '활어'],
    'pohang-guryongpo': ['물회', '과메기'], 'gyeongju-gampo': ['물회', '횟집', '회센터', '활어'], 'gyeongju-munmu': ['물회', '횟집', '회센터', '활어'],
}

hubs, items = [], []
for hid, label, gu, e in HUBS:
    hit = [r for r in rows if r['gu'] == gu and emd(r['ad'], gu) == e]
    if not hit:
        print('0곳, 제외:', label); continue
    kw = KW.get(hid, [])
    pick = lambda r: next((k for k in kw if k in r['nm']), '')
    hit.sort(key=lambda r: (pick(r) == '', r['nm']))
    hubs.append({'id': hid, 'label': label, 'n': len(hit), 'kw': kw, 'pick': sum(1 for r in hit if pick(r))})
    items += [[r['nm'], r['gb'], r['ad'], '' if r['tel'] in ('', '000-000-0000') else r['tel'], hid, pick(r)] for r in hit]

out = {'updated': updated, 'source': '농림축산식품부 안심식당 공공데이터(유효 지정)', 'hubs': hubs, 'items': items}
json.dump(out, open(os.path.join(H, 'data', 'restaurants.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for h in hubs: print(f"{h['n']:4d} (메뉴 일치 {h['pick']:2d})  {h['label']}")
print('합계', len(items))

if __name__ == '__main__':
    # 자가 점검: 읍면 추출이 맞는지
    assert emd('경상북도 경주시 감포읍 감포로 383', '경주시') == '감포읍'
    assert emd('전라남도 여수시 오동도로 61-7', '여수시') is None
    assert emd('강원특별자치도 강릉시 주문진읍 연주로 245-3', '강릉시') == '주문진읍'
