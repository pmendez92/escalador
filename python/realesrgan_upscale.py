"""
Escalado Real-ESRGAN vía PyTorch/CUDA (opcional).

La aplicación usa por defecto los binarios ncnn-vulkan (sin dependencias),
pero este script permite usar la implementación oficial en PyTorch cuando se
quiere CUDA puro en NVIDIA o experimentar con otros modelos .pth.

Uso:
    python realesrgan_upscale.py --input foto.png --output foto_x4.png \
        --model RealESRGAN_x4plus --scale 4 [--cpu]

Requisitos (ver requirements.txt):
    pip install -r requirements.txt

El script emite el progreso por stdout en formato "PROGRESS <pct>" para que
el proceso Node pueda parsearlo igual que hace con los binarios ncnn.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr, flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Real-ESRGAN (PyTorch/CUDA)")
    parser.add_argument("--input", required=True, help="Imagen de entrada")
    parser.add_argument("--output", required=True, help="Imagen de salida (PNG)")
    parser.add_argument("--model", default="RealESRGAN_x4plus", help="Nombre del modelo")
    parser.add_argument("--scale", type=int, default=4, choices=[2, 4, 8], help="Factor de escala")
    parser.add_argument("--cpu", action="store_true", help="Forzar CPU aunque haya CUDA")
    parser.add_argument("--tile", type=int, default=0, help="Tamaño de tile (0 = auto)")
    args = parser.parse_args()

    try:
        import torch
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
    except ImportError as exc:  # dependencias no instaladas
        eprint(f"ERROR: dependencia no instalada: {exc}. Ejecuta: pip install -r requirements.txt")
        return 2

    input_path = Path(args.input)
    if not input_path.exists():
        eprint(f"ERROR: no existe {input_path}")
        return 1

    device = "cpu" if args.cpu or not torch.cuda.is_available() else "cuda"
    eprint(f"Dispositivo: {device}")
    print("PROGRESS 5", flush=True)

    # Arquitectura RRDB estándar de Real-ESRGAN x4.
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    upscaler = RealESRGANer(
        scale=4,
        # El peso .pth se descarga automáticamente a ~/.cache la primera vez.
        model_path=(
            "https://github.com/xinntao/Real-ESRGAN/releases/download/"
            f"v0.1.0/{args.model}.pth"
        ),
        model=model,
        tile=args.tile,
        half=device == "cuda",  # FP16 en GPU: el doble de rápido
        device=device,
    )
    print("PROGRESS 20", flush=True)

    import cv2  # opencv-python, instalado como dependencia de realesrgan

    image = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
    if image is None:
        eprint("ERROR: no se pudo leer la imagen")
        return 1

    # 8x = dos pasadas de x4 con reducción posterior en la app.
    passes = 2 if args.scale == 8 else 1
    for i in range(passes):
        image, _ = upscaler.enhance(image, outscale=4)
        print(f"PROGRESS {20 + (70 * (i + 1) // passes)}", flush=True)

    if args.scale == 2:
        # Se pidió 2x: reducir el resultado 4x a la mitad (mejor detalle que
        # un modelo 2x nativo).
        h, w = image.shape[:2]
        image = cv2.resize(image, (w // 2, h // 2), interpolation=cv2.INTER_LANCZOS4)

    cv2.imwrite(str(args.output), image)
    print("PROGRESS 100", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
