#!/usr/bin/env bash
unzip -p data/mosmix.kmz $(unzip -l data/mosmix.kmz | tail -3 | head -1 | awk '{ print $4 }') > data/mosmix.kml
