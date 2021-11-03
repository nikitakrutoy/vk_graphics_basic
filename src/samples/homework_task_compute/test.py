import numpy as np

results = []
with open("result") as f:
    size = int(f.readline().strip())
    for line in f:
        results.extend(list(map(int, line.strip().split(" "))))

results = np.array(results)

test = [0]
for i in range(size):
    for j in range(size):
        test.append(i + j + 1)
print("SIZE", size)
print("CUMSUM: ", np.cumsum(test[:-1]))
assert(np.array_equal(np.cumsum(test[:-1]), results))

