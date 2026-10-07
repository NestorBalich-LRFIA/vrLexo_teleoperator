#!/usr/bin/env python
"""
Genera los materiales gráficos de Google Play en play/ (requiere Pillow):

  play/icono-512.png             icono de la ficha (512x512, PNG 32 bits, sin esquinas redondeadas)
  play/grafico-funciones.png     gráfico de funciones (1024x500)
  play/capturas/*.png            capturas de teléfono (copiadas de la carpeta indicada, máx. 2:1)
  play/app/                      el mismo logo para la app (icon, adaptive foreground/background/monochrome, splash)

Uso:  python tools/generar_play.py [carpeta_con_capturas]
El logo es un robot con visor VR; los colores salen del tema de la app (src/theme/index.ts).
"""
import os
import shutil
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'play')

FONDO = (11, 18, 32)
FONDO2 = (22, 32, 51)
ACENTO = (77, 171, 247)
ACENTO_OSC = (51, 154, 240)
ACENTO_CLARO = (116, 192, 252)
TEXTO = (245, 247, 251)
SUAVE = (180, 192, 214)
VERDE = (81, 207, 102)

FUENTE_NEGRITA = r'C:\Windows\Fonts\segoeuib.ttf'
FUENTE = r'C:\Windows\Fonts\segoeui.ttf'


def gradiente(w, h, arriba, abajo):
    base = Image.new('RGB', (w, h), arriba)
    tope = Image.new('RGB', (w, h), abajo)
    mascara = Image.linear_gradient('L').resize((w, h))
    return Image.composite(tope, base, mascara)


def robot(tam, fondo=True, solo_forma=False, color=None):
    """Dibuja el robot en un lienzo cuadrado `tam` (con supersampling). `solo_forma`: silueta blanca para el ícono monocromo."""
    k = 4
    n = tam * k
    u = n / 1024.0

    def r(*c):
        return [int(v * u) for v in c]

    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    if fondo:
        img.paste(gradiente(n, n, FONDO2, FONDO).convert('RGBA'))
    capa = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    cuerpo = (255, 255, 255) if solo_forma else (color or ACENTO)
    oscuro = cuerpo if solo_forma else (color or ACENTO_OSC)
    # antena
    d.rounded_rectangle(r(496, 215, 528, 330), radius=int(16 * u), fill=oscuro)
    d.ellipse(r(458, 135, 566, 243), fill=(255, 255, 255) if solo_forma else VERDE)
    # orejas
    d.rounded_rectangle(r(168, 455, 250, 625), radius=int(34 * u), fill=oscuro)
    d.rounded_rectangle(r(774, 455, 856, 625), radius=int(34 * u), fill=oscuro)
    # cabeza
    d.rounded_rectangle(r(232, 300, 792, 790), radius=int(140 * u), fill=cuerpo)
    if not solo_forma:
        brillo = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        bd = ImageDraw.Draw(brillo)
        bd.rounded_rectangle(r(262, 322, 762, 470), radius=int(110 * u), fill=(*ACENTO_CLARO, 120))
        capa = Image.alpha_composite(capa, brillo.filter(ImageFilter.GaussianBlur(int(18 * u))))
        d = ImageDraw.Draw(capa)
    # visor VR
    hueco = (0, 0, 0, 0) if solo_forma else (*FONDO, 255)
    visor = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    vd = ImageDraw.Draw(visor)
    vd.rounded_rectangle(r(284, 425, 740, 640), radius=int(100 * u), fill=(0, 0, 0, 255))
    if solo_forma:
        capa = Image.composite(Image.new('RGBA', (n, n), (0, 0, 0, 0)), capa, visor.split()[3])
    else:
        capa = Image.alpha_composite(capa, Image.composite(Image.new('RGBA', (n, n), hueco), Image.new('RGBA', (n, n), (0, 0, 0, 0)), visor.split()[3]))
    d = ImageDraw.Draw(capa)
    # ojos (en la silueta se dibujan de nuevo para que se vean dentro del visor)
    ojo = (255, 255, 255, 255) if solo_forma else (*TEXTO, 255)
    for cx in (421, 603):
        if not solo_forma:
            halo = Image.new('RGBA', (n, n), (0, 0, 0, 0))
            ImageDraw.Draw(halo).ellipse(r(cx - 62, 470, cx + 62, 594), fill=(*ACENTO, 150))
            capa = Image.alpha_composite(capa, halo.filter(ImageFilter.GaussianBlur(int(16 * u))))
            d = ImageDraw.Draw(capa)
        d.ellipse(r(cx - 40, 490, cx + 40, 570), fill=ojo)
    # boca
    if not solo_forma:
        d.rounded_rectangle(r(432, 696, 592, 724), radius=int(14 * u), fill=(*FONDO, 255))
    # sombra suave bajo la figura
    if fondo and not solo_forma:
        sombra = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        sombra.paste((0, 0, 0, 120), mask=capa.split()[3].filter(ImageFilter.GaussianBlur(int(26 * u))))
        sombra = ImageChops.offset(sombra, 0, int(22 * u))
        img = Image.alpha_composite(img, sombra)
    img = Image.alpha_composite(img, capa)
    return img.resize((tam, tam), Image.LANCZOS)


def con_margen(forma, tam, escala):
    """Centra la forma (RGBA transparente) en un lienzo `tam` reduciéndola a `escala` (zona segura del ícono adaptable)."""
    lienzo = Image.new('RGBA', (tam, tam), (0, 0, 0, 0))
    lado = int(tam * escala)
    f = forma.resize((lado, lado), Image.LANCZOS)
    lienzo.paste(f, ((tam - lado) // 2, (tam - lado) // 2), f)
    return lienzo


def fuente(ruta, px):
    return ImageFont.truetype(ruta, px)


def ajustar(d, texto, ruta, ancho_max, px):
    while px > 10 and d.textlength(texto, font=fuente(ruta, px)) > ancho_max:
        px -= 2
    return fuente(ruta, px)


def telefono(captura, alto):
    """Captura dentro de un marco de teléfono; devuelve RGBA con esquinas redondeadas."""
    c = Image.open(captura).convert('RGB')
    ancho = int(alto * c.width / c.height)
    c = c.resize((ancho, alto), Image.LANCZOS)
    borde = max(10, alto // 60)
    w, h = ancho + 2 * borde, alto + 2 * borde
    rad = alto // 11
    m = Image.new('L', (w * 2, h * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), radius=rad * 2, fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    marco = Image.new('RGBA', (w, h), (30, 41, 66, 255))
    mi = Image.new('L', (w * 2, h * 2), 0)
    ImageDraw.Draw(mi).rounded_rectangle((borde * 2, borde * 2, (w - borde) * 2, (h - borde) * 2), radius=(rad - borde) * 2, fill=255)
    mi = mi.resize((w, h), Image.LANCZOS)
    marco.paste(c, (borde, borde), mi.crop((borde, borde, borde + ancho, borde + alto)))
    marco.putalpha(m)
    return marco


def grafico_funciones(capturas):
    w, h = 1024, 500
    img = gradiente(w, h, FONDO2, FONDO).convert('RGBA')
    d = ImageDraw.Draw(img)
    # círculos suaves de fondo
    halo = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((560, -160, 1180, 460), fill=(*ACENTO, 55))
    hd.ellipse((-140, 300, 300, 740), fill=(*ACENTO, 30))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(40)))
    d = ImageDraw.Draw(img)
    # logo + textos
    logo = robot(170, fondo=False)
    img.alpha_composite(logo, (52, 70))
    d.text((240, 78), 'LexoDive', font=fuente(FUENTE_NEGRITA, 64), fill=TEXTO)
    d.text((240, 146), 'VR Controller', font=fuente(FUENTE_NEGRITA, 40), fill=ACENTO)
    f = fuente(FUENTE_NEGRITA, 33)
    y = 262
    for linea in ('Manejá el robot del simulador', 'VR Lexo o un robot físico', 'por Bluetooth, desde el celular.'):
        d.text((56, y), linea, font=f, fill=TEXTO)
        y += 46
    # pastillas
    x = 56
    for txt in ('QR del simulador', 'Bluetooth'):
        fp = fuente(FUENTE_NEGRITA, 22)
        tw = d.textlength(txt, font=fp)
        d.rounded_rectangle((x, 422, x + tw + 36, 466), radius=22, fill=(*ACENTO, 255))
        d.text((x + 18, 427), txt, font=fp, fill=(6, 16, 31))
        x += tw + 36 + 14
    # teléfonos
    if capturas:
        fondo_tel = telefono(capturas[min(1, len(capturas) - 1)], 470)
        img.alpha_composite(fondo_tel, (760, 40))
        if len(capturas) > 1:
            lat = telefono(capturas[0], 400)
            lat = lat.rotate(8, expand=True, resample=Image.BICUBIC)
            img.alpha_composite(lat, (560, 86))
            # el principal otra vez encima, para que quede delante
            img.alpha_composite(fondo_tel, (760, 40))
    return img.convert('RGB')


def main():
    carpeta_capturas = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(SALIDA, exist_ok=True)

    icono = robot(512, fondo=True).convert('RGB')
    icono.save(os.path.join(SALIDA, 'icono-512.png'), optimize=True)

    capturas = []
    if carpeta_capturas:
        destino = os.path.join(SALIDA, 'capturas')
        os.makedirs(destino, exist_ok=True)
        for nombre in sorted(os.listdir(carpeta_capturas)):
            if nombre[:2].isdigit() and nombre.endswith('.png'):
                shutil.copy(os.path.join(carpeta_capturas, nombre), os.path.join(destino, nombre))
                capturas.append(os.path.join(destino, nombre))
    grafico_funciones(capturas).save(os.path.join(SALIDA, 'grafico-funciones.png'), optimize=True)

    # Variante para la app (ícono adaptable: la zona segura es el 66 % central).
    app = os.path.join(SALIDA, 'app')
    os.makedirs(app, exist_ok=True)
    robot(1024, fondo=True).convert('RGB').save(os.path.join(app, 'icon.png'), optimize=True)
    gradiente(512, 512, FONDO2, FONDO).save(os.path.join(app, 'android-icon-background.png'), optimize=True)
    con_margen(robot(1024, fondo=False), 512, 0.78).save(os.path.join(app, 'android-icon-foreground.png'), optimize=True)
    con_margen(robot(1024, fondo=False, solo_forma=True), 432, 0.78).save(os.path.join(app, 'android-icon-monochrome.png'), optimize=True)
    robot(1024, fondo=False).save(os.path.join(app, 'splash-icon.png'), optimize=True)
    print('listo:', SALIDA)


if __name__ == '__main__':
    main()
