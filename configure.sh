
sudo apt update
sudo apt upgrade -y
sudo apt install -y git htop vim python3 imagemagick python3-pip python3-pil python3-numpy python3-spidev

#dependecies von node-canvas
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
#restart terminal
. ~/.bashrc
nvm install 21

ssh-keygen
cd
cat .ssh/id_rsa.pub
# key in github eintragen
git clone git@github.com:fjw/homeschirm.git
cd homeschirm
mkdir data

cd python_src
python3 -m venv .venv
source .venv/bin/activate

cd ..

#todo: sudo pip3 install spidev
npm install
