#include<stdio.h>
#include<math.h>


int main() {
    double x,term, sum = 0;
    int flag = 1;
    scanf("%lf", &x);

    for (int i = 1; i < 20; i += 2) {
        long long fact = 1;
        for (int j = 2; j <= i; j++) {
            fact *= j;
        }
        term = flag * (pow(x, i) / fact);
        sum += term;
        flag *= -1; 
    }

    printf("%.3f\n", sum);

    return 0;
}
