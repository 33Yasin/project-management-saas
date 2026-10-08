import { useState, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { ApiError } from '@/lib/api/api-fetch';
import { useLanguage } from '@/lib/i18n/language-context';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isRegistering } = useAuth({ enabled: false });
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t('auth.nameMinLength')),
        email: z.string().trim().email(t('auth.emailInvalid')),
        password: z
          .string()
          .min(8, t('auth.passwordMinLength'))
          .regex(/[A-Z]/, t('auth.passwordUppercase'))
          .regex(/[0-9]/, t('auth.passwordNumber')),
      }),
    [t]
  );

  type RegisterFormInput = z.input<typeof schema>;
  type RegisterFormOutput = z.output<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput, unknown, RegisterFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<RegisterFormOutput> = async (values) => {
    try {
      setServerError(null);
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      navigate('/workspaces', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message || t('auth.registrationFailed'));
      } else {
        setServerError(t('auth.unexpectedError'));
      }
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-md border-border/80">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.signUpTitle')}</CardTitle>
          <CardDescription>
            {t('auth.signUpSubtitle')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="p-3 text-sm rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {serverError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.fullName')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('auth.fullNamePlaceholder')}
                autoComplete="name"
                disabled={isRegistering}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                disabled={isRegistering}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isRegistering}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full cursor-pointer" disabled={isRegistering}>
              {isRegistering ? t('auth.creatingAccount') : t('auth.createAccount')}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t('auth.signIn')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
