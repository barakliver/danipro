#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Re-render the Markdown summary table and progress tracker from the CSV."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import taxonomy as T
from add_entry import load_rows, render_table

rows = load_rows()
print("התקדמות: {}/{} סרטונים קוטלגו\n".format(len(rows), T.TOTAL))
print(render_table(rows))
