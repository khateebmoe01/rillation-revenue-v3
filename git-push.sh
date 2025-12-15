#!/bin/bash
# Quick git push command
# Usage: ./git-push.sh "Your commit message here"

git add . && git commit -m "$1" && git push
