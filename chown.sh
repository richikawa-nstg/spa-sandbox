#!/bin/bash

# スクリプトのディレクトリに移動
cd "$(dirname "$0")"

# 現在のユーザーに所有権を変更
sudo chown -R $(whoami):$(whoami) app

