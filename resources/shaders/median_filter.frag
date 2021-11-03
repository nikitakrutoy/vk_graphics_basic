#version 450
#extension GL_ARB_separate_shader_objects : enable
#define KERNEL 3

layout(location = 0) out vec4 color;

layout (binding = 0) uniform sampler2D colorTex;

layout (location = 0 ) in VS_OUT
{
  vec2 texCoord;
} surf;


float arrR[KERNEL * KERNEL];
float arrG[KERNEL * KERNEL];
float arrB[KERNEL * KERNEL];

void bubbleSort()
{
  float tmp;
  vec4 tmp4;
  int n = KERNEL * KERNEL;
  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++)
    {
      if (arrR[j] > arrR[j + 1])
      {
        tmp = arrR[j];
        arrR[j] = arrR[j + 1];
        arrR[j + 1] = tmp;
      }
      if (arrG[j] > arrG[j + 1])
      {
        tmp = arrG[j];
        arrG[j] = arrG[j + 1];
        arrG[j + 1] = tmp;
      }
      if (arrB[j] > arrB[j + 1])
      {
        tmp = arrB[j];
        arrB[j] = arrB[j + 1];
        arrB[j + 1] = tmp;
      }
    }
  }
}

void main() {
  int s = (KERNEL - 1) / 2;
  vec2 delta = 1.0 / textureSize(colorTex, 0);
  vec4 texel;
  for (int i = 0; i < KERNEL; i++)
  {
    for (int j = 0; j < KERNEL; j++) {
      texel = textureLod(colorTex, surf.texCoord + vec2(i - s, j - s) * delta , 0);
      arrR[KERNEL * j + i] = texel.x;
      arrG[KERNEL * j + i] = texel.y;
      arrB[KERNEL * j + i] = texel.z;
    }
  }
  bubbleSort();
  color = vec4(arrR[KERNEL * KERNEL / 2], arrG[KERNEL * KERNEL / 2], arrB[KERNEL * KERNEL / 2], 1.0);
}
