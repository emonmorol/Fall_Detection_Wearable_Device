
#include<stdio.h>
int main()
{
    int n , fibo0 = 0, fibo1 = 1, fibo;

    scanf("%d",&n);
    printf("%d",fibo1);

    for(int i = 2; i <= n; i++)
    {
        fibo = fibo0 + fibo1;
        printf(", %d" , fibo);
        fibo0 = fibo1;
        fibo1 = fibo;
    }
    return 0;
}
