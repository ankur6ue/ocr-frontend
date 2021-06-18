import os

def increment_ver(version):
    version = version.split('.')
    version[2] = str(int(version[2]) + 1)
    return '.'.join(version)


with open('ui/web/static/version.txt', 'r') as f:
    version = f.readline()
    updated_version = increment_ver(version)

with open('ui/web/static/version.txt', 'w') as f:
    f.write(updated_version)

