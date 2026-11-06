"""Author editable conceptual figures and publication crops; no benchmark claims."""
from pathlib import Path
from xml.sax.saxutils import escape
import argparse
import math
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'media'
OUT.mkdir(parents=True, exist_ok=True)
INK, MUTED, TEAL, BLUE, EDGE = '#14283f', '#52647a', '#087f8c', '#4f46a5', '#d9e3ed'

def font(size, bold=False):
    names = [Path('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
    for name in names:
        if name.exists():
            return ImageFont.truetype(str(name), size)
    return ImageFont.load_default(size=size)

class Plate:
    def __init__(self, width, height, background='#ffffff'):
        self.w, self.h, self.scale = width, height, 2
        self.image = Image.new('RGB', (width * 2, height * 2), background)
        self.d = ImageDraw.Draw(self.image)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">', f'<rect width="{width}" height="{height}" fill="{background}"/>']
    def rect(self, x, y, w, h, fill='#fff', stroke=EDGE, radius=12, weight=1):
        self.d.rounded_rectangle(tuple(int(v*2) for v in (x,y,x+w,y+h)), radius=radius*2, fill=fill, outline=stroke, width=weight*2)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{weight}"/>')
    def text(self, x, y, content, size=22, color=INK, bold=False, anchor='start'):
        for row, line in enumerate(str(content).split('\n')):
            yy=y+row*round(size*1.42)
            f=font(size*2,bold)
            measured=self.d.textlength(line,font=f)
            xx=x*2-(measured/2 if anchor=='middle' else measured if anchor=='end' else 0)
            self.d.text((int(xx),yy*2),line,font=f,fill=color,anchor='lt')
            self.svg.append(f'<text x="{x}" y="{yy}" dominant-baseline="hanging" text-anchor="{anchor}" font-family="Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(line)}</text>')
    def line(self, x1, y1, x2, y2, color=EDGE, width=2, dash=False):
        if dash:
            length=math.hypot(x2-x1,y2-y1)
            for start in range(0,int(length),13):
                end=min(start+7,length)
                self.d.line((int((x1+(x2-x1)*start/length)*2),int((y1+(y2-y1)*start/length)*2),int((x1+(x2-x1)*end/length)*2),int((y1+(y2-y1)*end/length)*2)),fill=color,width=width*2)
        else:
            self.d.line((x1*2,y1*2,x2*2,y2*2),fill=color,width=width*2)
        dashed=' stroke-dasharray="7 6"' if dash else ''
        self.svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"{dashed}/>')
    def arrow(self,x1,y1,x2,y2,color=TEAL):
        self.line(x1,y1,x2,y2,color,2)
        a=math.atan2(y2-y1,x2-x1)
        points=[(x2,y2),(x2-10*math.cos(a)+5*math.sin(a),y2-10*math.sin(a)-5*math.cos(a)),(x2-10*math.cos(a)-5*math.sin(a),y2-10*math.sin(a)+5*math.cos(a))]
        self.d.polygon([(int(x*2),int(y*2)) for x,y in points],fill=color)
        self.svg.append('<polygon points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in points)+f'" fill="{color}"/>')
    def chip(self,x,y,label,width=130,color=TEAL):
        self.rect(x,y,width,42,'#e8f5f6' if color==TEAL else '#efedf8',color,9)
        self.text(x+width/2,y+10,label,18,color,True,'middle')
    def save(self,name):
        self.svg.append('</svg>')
        (OUT/(name+'.svg')).write_text('\n'.join(self.svg),encoding='utf-8')
        self.image.resize((self.w,self.h),Image.Resampling.LANCZOS).save(OUT/(name+'.png'),optimize=True)

p=Plate(1600,640,'#10243a')
p.text(75,62,'DSH / INLINE ATTACHMENTS',22,'#79d6d6',True)
p.text(75,125,'Files belong in the sentence.',58,'#ffffff',True)
p.text(78,220,'Position-aware references. Compact labels. Contextual image previews.',25,'#c5d5e3')
p.rect(75,322,1450,174,'#19344e','#34516b',22)
p.text(113,383,'Compare',33,'#ffffff')
p.chip(290,370,'reference-A.png',245)
p.text(560,383,'with',33,'#ffffff')
p.chip(660,370,'reference-B.png',245)
p.text(934,383,'and explain the difference.',33,'#ffffff')
p.text(80,552,'A focused interaction layer for DeepSeek Harness',22,'#aabed1')
p.text(1510,555,'EXPERIMENTAL PREVIEW',16,'#79d6d6',True,'end')
p.save('project-banner')

p=Plate(1600,920)
p.text(66,48,'FIGURE 1  /  SYSTEM ARCHITECTURE',18,TEAL,True)
p.text(66,92,'Position-preserving attachment references',43,INK,True)
p.text(68,156,'A semantic bridge between the composer and the conversation',23,MUTED)
p.line(66,210,1532,210)
stages=[('A','Compose','Text + inline chips','A.png / B.png'),('B','Native upload','Actual attachments','DSH upload queue'),('C','Reference codec','Versioned references','No DOM in transport'),('D','Session message','Attachments + text','Same-message context'),('E','Resolve','Identity / order','Bind the right file'),('F','Inline preview','Compact labels','Authorized image URL')]
for i,(key,title,line1,line2) in enumerate(stages):
    x=66+i*246
    p.text(x+4,255,key,19,TEAL,True)
    p.rect(x,298,230,265,'#f7fafc',EDGE,14)
    p.rect(x,298,230,8,TEAL if i<3 else BLUE,TEAL if i<3 else BLUE,0)
    p.text(x+18,330,title,23,INK,True)
    if i in (0,5):
        p.chip(x+19,385,'A.png',84)
        p.chip(x+121,385,'B.png',89)
    elif i==1:
        p.rect(x+25,382,180,48,'#e8f5f6','#a4d7dc',7)
        p.text(x+115,397,'FILE OBJECTS',15,TEAL,True,'middle')
    elif i==2:
        p.rect(x+25,382,180,48,'#efedf8','#c9c4e6',7)
        p.text(x+115,397,'REFERENCE TOKEN',14,BLUE,True,'middle')
    elif i==3:
        p.rect(x+20,378,190,28,'#e8f5f6','#a4d7dc',5)
        p.rect(x+20,418,190,28,'#efedf8','#c9c4e6',5)
        p.text(x+115,385,'attachments',13,TEAL,True,'middle')
        p.text(x+115,425,'text + references',13,BLUE,True,'middle')
    else:
        p.chip(x+25,383,'ref',70,BLUE)
        p.arrow(x+102,404,x+135,404)
        p.chip(x+142,383,'file',66)
    p.text(x+18,480,line1,18,INK)
    p.text(x+18,516,line2,16,MUTED)
    if i<5:p.arrow(x+233,427,x+242,427)
p.line(66,621,786,621,TEAL,2)
p.line(804,621,1530,621,BLUE,2)
p.text(426,642,'COMPOSER',17,TEAL,True,'middle')
p.text(1167,642,'CONVERSATION',17,BLUE,True,'middle')
p.rect(66,717,1466,104,'#f4f7fb',EDGE,12)
p.text(92,738,'Native transport remains unchanged.',22,INK,True)
p.text(92,777,'Browser File objects are not restored after a draft-page refresh. Upload receipts are not persisted in inline markers.',18,MUTED)
p.text(66,864,'Conceptual engineering schematic; not a benchmark or a formal security proof.',17,MUTED)
p.save('figure-architecture')

p=Plate(1600,920)
p.text(66,48,'FIGURE 2  /  INTERACTION MODEL',18,TEAL,True)
p.text(66,92,'Bring the reference closer to the instruction',43,INK,True)
p.text(68,156,'The design goal is explicit context, not another attachment-management panel.',23,MUTED)
for x,label in [(66,'(a) Detached attachment rail'),(840,'(b) Inline attachment references')]:
    p.text(x,240,label,25,INK,True)
    p.rect(x,297,692,370,'#f7fafc',EDGE,18)
p.chip(105,332,'A.png',150,BLUE)
p.chip(278,332,'B.png',150,BLUE)
p.line(104,399,718,399)
p.text(105,480,'Compare this image',29,INK)
p.text(105,532,'with that image.',29,INK)
p.line(180,378,180,452,BLUE,2,True)
p.line(353,378,353,424,BLUE,2,True)
p.line(353,424,286,424,BLUE,2,True)
p.line(286,424,286,518,BLUE,2,True)
p.text(412,438,'mental mapping',17,MUTED)
p.text(101,608,'Words and files live in separate places.',19,MUTED)
p.text(879,475,'Compare',29,INK)
p.chip(1020,463,'A.png',124)
p.text(1164,475,'with',29,INK)
p.chip(1250,463,'B.png',124)
p.text(1388,475,'.',29,INK)
p.rect(1193,317,262,112,'#ffffff','#9dcbd0',12)
p.text(1324,337,'Image preview',18,TEAL,True,'middle')
p.line(1220,399,1248,377,BLUE,3)
p.line(1248,377,1280,391,BLUE,3)
p.line(1280,391,1321,363,BLUE,3)
p.line(1321,363,1360,380,BLUE,3)
p.line(1360,380,1419,349,BLUE,3)
p.line(1312,429,1312,459,TEAL,2)
p.text(878,608,'The reference is part of the sentence.',19,TEAL,True)
p.rect(66,729,1466,92,'#f4f7fb',EDGE,12)
p.text(91,749,'Design intent',20,INK,True)
p.text(91,783,'Keep the file label next to the instruction it qualifies; reveal image detail on demand.',20,MUTED)
p.text(66,864,'Interaction model illustration; not an empirical usability study.',17,MUTED)
p.save('figure-interaction')

parser=argparse.ArgumentParser()
parser.add_argument('--screenshots',type=Path)
args=parser.parse_args()
if args.screenshots:
    sources=[('行内文件显示效果.png','screenshot-composer.jpg',(0.055,0.30,0.985,0.90)),('鼠标停滞显示效果.png','screenshot-hover.jpg',(0.36,0.055,0.96,0.44)),('既可以手动添加，也可以拖动添加.png','screenshot-intake.jpg',(0.06,0.475,0.94,0.945))]
    for source,target,box in sources:
        with Image.open(args.screenshots/source) as opened:
            image=ImageOps.exif_transpose(opened).convert('RGB')
            w,h=image.size
            image=image.crop(tuple(round(value*(w if i%2==0 else h)) for i,value in enumerate(box)))
            if image.width>1800:
                image=image.resize((1800,round(image.height*1800/image.width)),Image.Resampling.LANCZOS)
            image.save(OUT/target,quality=91,optimize=True,subsampling=0)
print('Release figures and requested screenshot crops are ready in docs/media.')
