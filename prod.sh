npm run build
rsync -av --delete --no-owner --no-group --no-perms --omit-dir-times packages/browser-client/dist/ /home/yabelFish/
tmux new-session -d -s yabelfish-prod 'npx http-server /home/yabelFish -p 8080'
