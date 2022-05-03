#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : require

#include "common.h"

layout(location = 0) out vec4 color;

layout(binding = 0) uniform AppData
{
    UniformParams Params;
};
layout (binding = 1) uniform sampler2D sdfTex;

layout (location = 0 ) in VS_OUT
{
  vec2 texCoord;
} surf;

layout(push_constant) uniform params_t
{
    float rotX;
    float rotY;
    int draw_normal;
    vec3 translate;
} params;

int getindex(int x, int y, int z) {
  return z * 64 * 64 + y * 64 + x;
}

float width = 64;
float height = 64;
float depth = 32;
float scale = 1.0 / 20.0;

float textureWidth = 64;
float textureHeight = 3584;

float PI = 3.14;

mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(1, 0, 0),
        vec3(0, c, -s),
        vec3(0, s, c)
    );
}

mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(c, 0, s),
        vec3(0, 1, 0),
        vec3(-s, 0, c)
    );
}

float getdist(vec3 p) {
  p = rotateY(params.rotY / 180.0 * PI) * rotateX(params.rotX / 180.0 * PI) * (p / scale + params.translate);
  vec3 bbox = vec3(width, depth, height);
  vec3 biased = p + bbox / 2.0;
  if (any(greaterThan(biased, bbox - 1)) || any(lessThan(biased, vec3(1)))) {
    return 1;
  }
  biased.y = biased.y - 1;
  int x = int(floor(biased.x));
  int y1 = int(floor(biased.y));
  int y2 = int(ceil(biased.y));
  int z = int((biased.z));
  float y_w = fract(biased.y);
  float u = x / (textureWidth);
  float v1 = (y1  * textureWidth + z) / (textureHeight);
  float v2 = (y2  * textureWidth + z) / (textureHeight);
  float result1 = Params.maxStoreDist * textureLod(sdfTex, vec2(u, v1), 0).x;
  float result2 = Params.maxStoreDist * textureLod(sdfTex, vec2(u, v2), 0).x;
  float result = y_w * result1 + (1 - y_w) * result2;
  
  return result;
}

float getdist2(vec3 p) {
  vec3 bbox = vec3(width, depth, height);
  vec3 biased = p + bbox / 2.0;
  if (any(greaterThan(biased, bbox - 1)) || any(lessThan(biased, vec3(1)))) {
    return 1;
  }
  biased.y = biased.y - 1;
  int x = int(floor(biased.x));
  int y1 = int(floor(biased.y));
  int y2 = int(ceil(biased.y));
  int z = int((biased.z));
  float y_w = fract(biased.y);
  float u = x / (textureWidth);
  float v1 = (y1  * textureWidth + z) / (textureHeight);
  float v2 = (y2  * textureWidth + z) / (textureHeight);
  float result1 = Params.maxStoreDist * textureLod(sdfTex, vec2(u, v1), 0).x;
  float result2 = Params.maxStoreDist * textureLod(sdfTex, vec2(u, v2), 0).x;
  float result = y_w * result1 + (1 - y_w) * result2;
  
  return result;
}

vec3 getnormal(vec3 p) {
  float delta = 0.1;
  float dist = getdist(p);
  float distX = getdist(p + vec3(delta, 0, 0));
  float distY = getdist(p + vec3(0, delta, 0));
  float distZ = getdist(p + vec3(0, 0, delta));
  float distX2 = getdist(p - vec3(delta, 0, 0));
  float distY2 = getdist(p - vec3(0, delta, 0));
  float distZ2 = getdist(p - vec3(0, 0, delta));
  return normalize(vec3(distX - distX2, distY - distY2, distZ - distZ2) / (2 * delta));
}

vec3 getnormal2(vec3 p) {
  p = rotateY(params.rotY / 180.0 * PI) * rotateX(params.rotX / 180.0 * PI) * (p / scale + params.translate);
  float delta = 0.2;
  float dist = getdist(p);
  float distX = getdist2(p + vec3(delta, 0, 0));
  float distY = getdist2(p + vec3(0, delta, 0));
  float distZ = getdist2(p + vec3(0, 0, delta));
  float distX2 = getdist2(p - vec3(delta, 0, 0));
  float distY2 = getdist2(p - vec3(0, delta, 0));
  float distZ2 = getdist2(p - vec3(0, 0, delta));
  return normalize(vec3(distX - distX2, distY - distY2, distZ - distZ2) / (2 * delta));
}


float trace ( in vec3 from, in vec3 dir, out bool hit, out vec3 normal)
{
	vec3	p         = from;
	float	totalDist = 0.0;

  normal = vec3(-1, -1, -1);
	hit = false;
	
  int stepNum = Params.stepNum;
	for ( int steps = 0; steps < stepNum; steps++ )
	{
    float dist = getdist(p);

		if ( dist < Params.thres )
		{
			hit = true;
      normal = getnormal2(p);
			return totalDist;
		}
    float m = Params.stepSize;
		if (Params.stepSize == 0.0f) {
      m = scale / 10;
    }
    p += dist * dir * m; 
		totalDist += dist * m;
		
		if ( totalDist > Params.maxTraceDist )
			break;	
	}
	return 0;
}


void main()
{
  vec3 lightPos = vec3(0, -6., 0.);
  vec3 cameraPos = vec3(0., 1, 0.);
  vec3 cameraForward = vec3(0., -1, 0.);
  vec3 cameraUp = vec3 (0., 0., 1.);

  vec2 uv = surf.texCoord.xy * 1;
  vec3 from = vec3(uv.x, 0, uv.y);
  vec3 dir = normalize(from - cameraPos);

  bool hit = false;
  vec3 normal;
  float d = trace(cameraPos, dir, hit, normal);
  // vec3 light_dir = rotateY(params.rotY / 180.0 * PI) * rotateX(params.rotX / 180.0 * PI) * normalize(Params.lightDir);
  float lambert = max(0.0, dot(-normalize(Params.lightDir), (normal * 0.5 + 0.5)));

  vec4 backgroundColor = vec4(0.1, 0.1, 0.1, 1);
  vec4 surfaceColor = vec4(0.5, 0.7, 0.7, 1);
  if (hit)
    if (params.draw_normal == 1)
      color = vec4(normal * 0.5 + 0.5, 1);
    else
      color = surfaceColor * lambert;
  else
    color = backgroundColor;
}
