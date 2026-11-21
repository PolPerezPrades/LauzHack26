#!/usr/bin/env python3
"""Minimal V4L2 control tool (no v4l-utils needed).

Usage:
  camctl.py [DEVICE]                 list all controls with current values
  camctl.py DEVICE name=value ...    set controls (name as listed, e.g. zoom_absolute=100)
"""
import fcntl
import os
import re
import struct
import sys

VIDIOC_QUERYCTRL = 0xC0445624
VIDIOC_G_CTRL = 0xC008561B
VIDIOC_S_CTRL = 0xC008561C
VIDIOC_QUERYMENU = 0xC02C5625
FLAG_NEXT_CTRL = 0x80000000
FLAG_DISABLED = 0x0001
FLAG_INACTIVE = 0x0010
QCTRL_FMT = "=II32siiiiI2I"
TYPES = {1: "int", 2: "bool", 3: "menu", 4: "button", 5: "int64", 6: "class", 7: "string", 8: "bitmask", 9: "intmenu"}


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def query_all(fd):
    ctrls = []
    cid = FLAG_NEXT_CTRL
    while True:
        buf = bytearray(struct.pack(QCTRL_FMT, cid, 0, b"", 0, 0, 0, 0, 0, 0, 0))
        try:
            fcntl.ioctl(fd, VIDIOC_QUERYCTRL, buf)
        except OSError:
            break
        id_, typ, name, mn, mx, step, dflt, flags, _, _ = struct.unpack(QCTRL_FMT, buf)
        name = name.split(b"\0")[0].decode()
        cid = id_ | FLAG_NEXT_CTRL
        if typ == 6 or flags & FLAG_DISABLED:
            continue
        ctrls.append(dict(id=id_, type=typ, name=name, slug=slug(name), min=mn, max=mx,
                          step=step, default=dflt, flags=flags))
    return ctrls


def get_ctrl(fd, cid):
    buf = bytearray(struct.pack("=Ii", cid, 0))
    fcntl.ioctl(fd, VIDIOC_G_CTRL, buf)
    return struct.unpack("=Ii", buf)[1]


def set_ctrl(fd, cid, value):
    buf = bytearray(struct.pack("=Ii", cid, value))
    fcntl.ioctl(fd, VIDIOC_S_CTRL, buf)


def menu_items(fd, c):
    items = {}
    for i in range(c["min"], c["max"] + 1):
        buf = bytearray(struct.pack("=II32sI", c["id"], i, b"", 0))
        try:
            fcntl.ioctl(fd, VIDIOC_QUERYMENU, buf)
        except OSError:
            continue
        items[i] = struct.unpack("=II32sI", buf)[2].split(b"\0")[0].decode()
    return items


def main():
    dev = sys.argv[1] if len(sys.argv) > 1 else "/dev/video2"
    fd = os.open(dev, os.O_RDWR)
    ctrls = query_all(fd)
    by_slug = {c["slug"]: c for c in ctrls}

    for arg in sys.argv[2:]:
        k, v = arg.split("=", 1)
        c = by_slug[k]
        set_ctrl(fd, c["id"], int(v))
        print(f"set {k} = {get_ctrl(fd, c['id'])}")
    if len(sys.argv) > 2:
        return

    for c in ctrls:
        try:
            val = get_ctrl(fd, c["id"])
        except OSError as e:
            val = f"<{e.strerror}>"
        extra = " (inactive)" if c["flags"] & FLAG_INACTIVE else ""
        line = (f"{c['slug']:32s} {TYPES.get(c['type'], c['type']):6s} min={c['min']} max={c['max']} "
                f"step={c['step']} default={c['default']} value={val}{extra}")
        print(line)
        if c["type"] == 3:
            for i, n in menu_items(fd, c).items():
                print(f"{'':36s}{i}: {n}")


if __name__ == "__main__":
    main()
